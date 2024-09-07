from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count, Q
from django.views.decorators.csrf import csrf_exempt
from .models import UserProfile, Raid, Participation, Competition, Program, Enrollment, PVPRequest, PresaleData,  PreSaleTransaction, Keypair
from datetime import timedelta
from solders.keypair import Keypair as SolanaKeypair
from PIL import Image, ImageDraw, ImageFont
import requests
import io
import base64
import base58
import json
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
def presale_status(request):
    if request.method == 'GET':
        try:
            presale_data = PresaleData.objects.first()
            if presale_data:
                return JsonResponse({
                    'status': 'success',
                    'tokens_sold': presale_data.tokens_sold
                })
            else:
                return JsonResponse({
                    'status': 'success',
                    'tokens_sold': 0
                })
        except Exception as e:
            logger.error(f"Presale status error: {str(e)}")
            return JsonResponse({'error': 'An unexpected error occurred'}, status=500)
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@require_http_methods(["GET"])
@login_required
def user_dashboard(request, public_key):
    try:
        if request.user.username != public_key:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        user_profile, created = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={'public_key': public_key}
        )

        if created:
            logger.info(f"Created new UserProfile for user {request.user.id}")

        # Calculate earnings history (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        earnings_history = Participation.objects.filter(
            user=user_profile,
            raid__competition__end_time__gte=thirty_days_ago
        ).values('raid__competition__end_time__date').annotate(
            earnings=Sum('raid__reward_cap')
        ).order_by('raid__competition__end_time__date')

        earnings_history = [
            {
                'date': entry['raid__competition__end_time__date'].strftime('%Y-%m-%d'),
                'earnings': float(entry['earnings'] or 0)
            } for entry in earnings_history
        ]

        # Get user leaderboard
        user_leaderboard = UserProfile.objects.order_by('-total_rewards')[:10].values(
            'public_key', 'total_rewards', 'engagement_score', 'streaks'
        )

        # Get program leaderboard
        program_leaderboard = Program.objects.annotate(
            participants=Count('enrollment'),
            total_raids=Count('raid'),
        ).order_by('-total_rewards_distributed')[:10].values(
            'id', 'name', 'participants', 'completed_raids', 'total_rewards_distributed'
        )

        # Get all competitions
        competitions = get_or_create_competitions()

        # Get all raids
        raids = Raid.objects.select_related('program', 'competition').order_by('-competition__start_time')

        # Get user's enrolled programs
        enrolled_programs = Enrollment.objects.filter(user=user_profile).select_related('program').values(
            'program__id', 'program__name', 'program__description', 'program__size'
        )

        return JsonResponse({
            'user': {
                'public_key': user_profile.public_key,
                'total_rewards': str(user_profile.total_rewards),
                'participated_raids': user_profile.participated_raids,
                'raid_ranking': user_profile.raid_ranking,
                'engagement_score': str(user_profile.engagement_score),
                'streaks': user_profile.streaks,
            },
            'earningsHistory': earnings_history,
            'userLeaderboard': list(user_leaderboard),
            'programLeaderboard': list(program_leaderboard),
            'competitions': competitions,
            'raids': [
                {
                    'id': raid.id,
                    'program_name': raid.program.name,
                    'competition_type': raid.competition.get_competition_type_display(),
                    'status': raid.competition.status,
                    'start_time': raid.start_time.isoformat() if raid.start_time else None,
                    'end_time': raid.end_time.isoformat() if raid.end_time else None,
                    'reward_cap': str(raid.reward_cap),
                    'participants_count': raid.participants_count,
                } for raid in raids
            ],
            'enrolled_programs': list(enrolled_programs)
        })
    except Exception as e:
        logger.error(f"Error in user_dashboard: {str(e)}", exc_info=True)
        return JsonResponse({'error': 'An unexpected error occurred'}, status=500)

@csrf_exempt
@login_required
def check_presale_access(request):
    if request.method == 'GET':
        if request.user.is_authenticated:
            user_profile, created = UserProfile.objects.get_or_create(user=request.user)
            has_access = user_profile.has_presale_access
            return JsonResponse({'has_access': has_access})
        return JsonResponse({'has_access': False})
    return JsonResponse({'error': 'Invalid request method'}, status=405)

@require_http_methods(["GET"])
@login_required
def get_presale_transactions(request):
    transactions = PreSaleTransaction.objects.filter(user=request.user.userprofile).order_by('-transaction_date')
    return JsonResponse({
        'transactions': [
            {
                'date': tx.transaction_date,
                'solAmount': str(tx.sol_amount),
                'tokenAmount': str(tx.token_amount),
                'type': tx.transaction_type
            } for tx in transactions
        ]
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def update_user_profile(request):
    data = json.loads(request.body)
    user = request.user
    user_profile = UserProfile.objects.get_or_create(user=user)
    if data.get('twitter'):
        user_profile.twitter_handle = data.get('twitter')
    if data.get('dob'):
        user_profile.date_of_birth = data.get('dob')
    user_profile.date_of_birth = data.get('dob', user_profile.date_of_birth)
    if 'profile_picture' in request.FILES:
        user_profile.profile_picture = request.FILES['profile_picture']
    user_profile.save()
    return JsonResponse({'status': 'success'})


@csrf_exempt
@login_required
def grant_presale_access(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        email = data.get('email')
        agreed_to_terms = data.get('agreed_to_terms')
        public_key = data.get('public_key')

        if not email or not agreed_to_terms or not public_key:
            return JsonResponse({'status': 'error', 'message': 'Missing required fields'}, status=400)

        user_profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'public_key': public_key})
        user_profile.agreed_to_terms = agreed_to_terms
        user_profile.email = email
        user_profile.save()

        user_profile.send_verification_email()

        return JsonResponse({'status': 'success', 'message': 'Verification email sent'})

    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
@login_required
def verify_email(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        email = data.get('email')
        verification_code = data.get('verification_code')
        public_key = data.get('public_key')

        try:
            user_profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'public_key': public_key})
            if user_profile.verification_code == verification_code and \
               user_profile.verification_code_expiration > timezone.now():
                user_profile.is_email_verified = True
                user_profile.has_presale_access = True  # Grant presale access here
                user_profile.save()

                # Generate Solana keypair for presale
                solana_keypair = SolanaKeypair()
                presale_public_key = str(solana_keypair.pubkey())
                private_key_str = base58.b58encode(solana_keypair.secret()).decode('utf-8')

                keypair, _ = Keypair.objects.get_or_create(user=request.user)
                keypair.public_key = presale_public_key
                keypair.set_private_key(private_key_str)
                keypair.save()

                return JsonResponse({
                    'status': 'success',
                    'message': 'Email verified successfully',
                    'has_presale_access': True,
                    'presale_public_key': presale_public_key
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid or expired verification code'
                }, status=400)

        except User.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'User not found'
            }, status=404)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
@login_required
def get_user_data(request):
    if request.method == 'GET':
        if request.user.is_authenticated:
            user_profile, created = UserProfile.objects.get_or_create(user=request.user)

            presale_public_key = None
            if user_profile.has_presale_access:
                try:
                    keypair = Keypair.objects.get(user=request.user)
                    presale_public_key = keypair.public_key
                except Keypair.DoesNotExist:
                    logger.warning(f"Keypair not found for user {request.user.id} with presale access")

            return JsonResponse({
                'id': user_profile.id,  # Include the user ID here
                'email': user_profile.email,
                'presale_public_key': presale_public_key,  # This will be null if keypair doesn't exist
                'presaleTokens': str(user_profile.token_holdings) if user_profile.has_presale_access else "0",
                'has_presale_access': user_profile.has_presale_access,
                'is_email_verified': user_profile.is_email_verified,
                'agreed_to_terms': user_profile.agreed_to_terms
            })

        return JsonResponse({'status': 'error', 'message': 'User not authenticated'}, status=401)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

def get_or_create_competitions():
    competition_types = ['4-program', '6-program', '12-program', '24-program']
    competitions = []

    for comp_type in competition_types:
        pending_comp = Competition.objects.filter(competition_type=comp_type, status='pending').first()
        if not pending_comp:
            pending_comp = Competition.objects.create(competition_type=comp_type, status='pending')

        active_comp = Competition.objects.filter(competition_type=comp_type, status='active').first()

        competitions.append({
            'id': pending_comp.id,
            'type': pending_comp.get_competition_type_display(),
            'status': 'pending',
            'enrolled_programs': 0,
            'required_programs': pending_comp.required_programs,
            'start_time': None,
            'raids': []
        })

        if active_comp:
            raids = Raid.objects.filter(competition=active_comp)
            competitions.append({
                'id': active_comp.id,
                'type': active_comp.get_competition_type_display(),
                'status': 'active',
                'enrolled_programs': raids.count(),
                'required_programs': active_comp.required_programs,
                'start_time': active_comp.start_time.isoformat() if active_comp.start_time else None,
                'raids': [
                    {
                        'id': raid.id,
                        'program_name': raid.program.name,
                        'reward_cap': str(raid.reward_cap),
                        'participants_count': raid.participants_count,
                    } for raid in raids
                ]
            })

    return competitions

@require_http_methods(["GET"])
@login_required
def available_programs(request):
    user_profile = request.user.userprofile
    enrolled_program_ids = Enrollment.objects.filter(user=user_profile).values_list('program_id', flat=True)

    available_programs = Program.objects.exclude(id__in=enrolled_program_ids).values('id', 'name', 'description', 'size')

    return JsonResponse({
        'programs': list(available_programs)
    })

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def create_program(request):
    data = json.loads(request.body)
    user_profile = request.user.userprofile

    program = Program.objects.create(
        name=data['name'],
        description=data['description'],
        creator=user_profile,
        size=0  # Initialize size to 0
    )

    return JsonResponse({
        'status': 'success',
        'program': {
            'id': program.id,
            'name': program.name,
            'description': program.description,
            'total_rewards_distributed': str(program.total_rewards_distributed),
            'size': program.size,
            'created_at': program.created_at.isoformat()
        }
    })

@require_http_methods(["PUT"])
@login_required
@csrf_exempt
def update_program(request, program_id):
    data = json.loads(request.body)
    user = request.user
    user_profile, _ = UserProfile.objects.get_or_create(user=user)
    program, _ = Program.objects.get_or_create(creator=user_profile)
    if data.get('name'):
        program.name = data['name']
    if data.get('description'):
        program.description = data['description']
    if 'profile_picture' in request.FILES:
        program.profile_picture = request.FILES['profile_picture']
    program.save()

    return JsonResponse({
        'status': 'success',
        'program': {
            'id': program.id,
            'name': program.name,
            'description': program.description,
            'total_rewards_distributed': str(program.total_rewards_distributed),
            'size': program.size,
            'created_at': program.created_at.isoformat()
        }
    })

@require_http_methods(["DELETE"])
@login_required
@csrf_exempt
def delete_program(request, program_id):
    program = get_object_or_404(Program, id=program_id, creator=request.user.userprofile)
    program.delete()

    return JsonResponse({
        'status': 'success',
        'message': 'Program deleted successfully'
    })

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def initiate_raid(request, program_id):
    try:
        program = get_object_or_404(Program, id=program_id)
        if program.is_conducting_raid:
            return JsonResponse({'error': 'This program is already conducting a raid'}, status=400)

        data = json.loads(request.body)
        competition_type = data.get('competition_type')

        if competition_type == 'pvp':
            challenged_public_key = data.get('challenged_public_key')
            if not challenged_public_key:
                return JsonResponse({'error': 'Challenged user public key is required for PVP'}, status=400)

            challenged_user = get_object_or_404(UserProfile, public_key=challenged_public_key)
            challenged_program = challenged_user.created_programs.first()

            if challenged_program.is_conducting_raid:
                return JsonResponse({'error': 'The challenged program is already in a raid'}, status=400)

            pvp_request = PVPRequest.objects.create(
                challenger=request.user.userprofile,
                challenged=challenged_user,
                challenger_program=program,
                challenged_program=challenged_program,
            )

            return JsonResponse({
                'status': 'success',
                'message': 'PVP request sent successfully',
                'request_id': pvp_request.id
            })

        competition = get_or_create_competition(competition_type)

        if program.start_raid():
            raid = Raid.objects.create(
                program=program,
                competition=competition,
                reward_cap=calculate_reward_cap(competition_type, program),
            )

            if Raid.objects.filter(competition=competition).count() == competition.required_programs:
                competition.set_start_and_end_times()
                competition.status = 'active'
                competition.save()

            return JsonResponse({
                'status': 'success',
                'raid': {
                    'id': raid.id,
                    'competition_type': competition.get_competition_type_display(),
                    'reward_cap': str(raid.reward_cap),
                    'status': competition.status,
                }
            })
        else:
            return JsonResponse({'error': 'Failed to start raid'}, status=400)
    except Exception as e:
        logger.error(f"Error in initiate_raid: {str(e)}", exc_info=True)
        return JsonResponse({'error': 'An unexpected error occurred'}, status=500)

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def join_raid(request, raid_id):
    raid = get_object_or_404(Raid, id=raid_id)
    user_profile = request.user.userprofile

    # Check if user is enrolled in the program, if not, enroll them
    enrollment, created = Enrollment.objects.get_or_create(user=user_profile, program=raid.program)
    if created:
        raid.program.size += 1
        raid.program.save()

    # Check if user is already participating in this raid
    if Participation.objects.filter(user=user_profile, raid=raid).exists():
        return JsonResponse({'error': 'You are already participating in this raid'}, status=400)

    participation = Participation.objects.create(
        user=user_profile,
        raid=raid,
        program=raid.program,
        engagement_score=0
    )

    raid.participants_count += 1
    raid.save()

    user_profile.participated_raids += 1
    user_profile.save()

    return JsonResponse({
        'status': 'success',
        'message': 'Successfully joined the raid',
        'engagement_score': str(participation.engagement_score)
    })

@require_http_methods(["GET"])
@login_required
def raid_status(request, raid_id):
    raid = get_object_or_404(Raid, id=raid_id)
    participants = Participation.objects.filter(raid=raid).order_by('-engagement_score')

    if timezone.now() > raid.competition.end_time and raid.competition.status == 'active':
        distribute_rewards(raid.competition)

    return JsonResponse({
        'raid': {
            'id': raid.id,
            'program_name': raid.program.name,
            'competition_type': raid.competition.get_competition_type_display(),
            'start_time': raid.competition.start_time.isoformat() if raid.competition.start_time else None,
            'end_time': raid.competition.end_time.isoformat() if raid.competition.end_time else None,
            'reward_cap': str(raid.reward_cap),
            'status': raid.competition.status,
            'total_rewards_distributed': str(raid.total_rewards_distributed),
            'participants_count': raid.participants_count,
        },
        'participants': [
            {
                'public_key': p.user.public_key,
                'engagement_score': str(p.engagement_score)
            } for p in participants
        ]
    })

@require_http_methods(["GET"])
@login_required
def creator_dashboard(request, public_key):
    if request.user.username != public_key:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    user_profile = get_object_or_404(UserProfile, public_key=public_key)
    programs = Program.objects.filter(creator=user_profile)

    return JsonResponse({
        'programs': [
            {
                'id': program.id,
                'name': program.name,
                'description': program.description,
                'total_rewards_distributed': str(program.total_rewards_distributed),
                'size': program.size,
                'created_at': program.created_at.isoformat(),
                'is_conducting_raid': program.is_conducting_raid,
            } for program in programs
        ]
    })

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def enroll_in_program(request):
    data = json.loads(request.body)
    program_id = data.get('program_id')
    if not program_id:
        return JsonResponse({'error': 'Program ID is required'}, status=400)

    program = get_object_or_404(Program, id=program_id)
    user_profile = request.user.userprofile

    enrollment, created = Enrollment.objects.get_or_create(user=user_profile, program=program)

    if created:
        program.size += 1
        program.save()
        return JsonResponse({'status': 'success', 'message': 'Successfully enrolled in the program'})
    else:
        return JsonResponse({'status': 'info', 'message': 'Already enrolled in this program'})

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def update_engagement_score(request, participation_id):
    data = json.loads(request.body)
    participation = get_object_or_404(Participation, id=participation_id)

    if participation.user != request.user.userprofile:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    if participation.raid.competition.status != 'active':
        return JsonResponse({'error': 'Raid is not active'}, status=400)

    new_score = data.get('engagement_score')
    if new_score is None:
        return JsonResponse({'error': 'Engagement score is required'}, status=400)

    participation.engagement_score = new_score
    participation.save()

    return JsonResponse({
        'status': 'success',
        'message': 'Engagement score updated successfully',
        'new_score': str(participation.engagement_score)
    })

def distribute_rewards(competition):
    raids = Raid.objects.filter(competition=competition)
    total_engagement = sum(
        Participation.objects.filter(raid=raid).aggregate(Sum('engagement_score'))['engagement_score__sum'] or 0
        for raid in raids
    )

    if total_engagement == 0:
        return  # No engagement, no rewards to distribute

    for raid in raids:
        raid_participants = Participation.objects.filter(raid=raid)
        raid_engagement = sum(p.engagement_score for p in raid_participants)
        raid_reward = (raid_engagement / total_engagement) * competition.total_rewards_distributed

        for participation in raid_participants:
            user_profile = participation.user
            user_share = (participation.engagement_score / raid_engagement) * raid_reward
            user_profile.total_rewards += user_share
            user_profile.save()

        raid.total_rewards_distributed = raid_reward
        raid.program.total_rewards_distributed += raid_reward
        raid.program.end_raid()
        raid.save()

    competition.status = 'completed'
    competition.save()

    # Create new pending competitions
    for comp_type in Competition.COMPETITION_TYPES:
        if comp_type[0] != 'pvp':
            Competition.objects.create(competition_type=comp_type[0], status='pending')

def calculate_reward_cap(competition_type, program):
    base_cap = {
        '4-program': 2000,
        '6-program': 3000,
        '12-program': 4000,
        '24-program': 5000
    }.get(competition_type, 1000)

    return min(base_cap, program.total_rewards_distributed * 0.1)

@require_http_methods(["GET"])
@login_required
def get_pvp_requests(request):
    user_profile = request.user.userprofile
    pvp_requests = PVPRequest.objects.filter(Q(challenger=user_profile) | Q(challenged=user_profile))

    return JsonResponse({
        'pvp_requests': [
            {
                'id': req.id,
                'challenger': req.challenger.public_key,
                'challenged': req.challenged.public_key,
                'status': req.status,
                'created_at': req.created_at.isoformat()
            } for req in pvp_requests
        ]
    })

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def send_pvp_request(request):
    data = json.loads(request.body)
    challenger = request.user.userprofile
    challenged_public_key = data.get('challenged_public_key')

    if not challenged_public_key:
        return JsonResponse({'error': 'Challenged user public key is required'}, status=400)

    challenged = get_object_or_404(UserProfile, public_key=challenged_public_key)

    if challenger == challenged:
        return JsonResponse({'error': 'You cannot challenge yourself'}, status=400)

    pvp_request, created = PVPRequest.objects.get_or_create(
        challenger=challenger,
        challenged=challenged,
        defaults={'status': 'pending'}
    )

    if not created:
        return JsonResponse({'error': 'PVP request already exists'}, status=400)

    return JsonResponse({
        'status': 'success',
        'message': 'PVP request sent successfully',
        'request_id': pvp_request.id
    })

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def respond_to_pvp_request(request, request_id):
    pvp_request = get_object_or_404(PVPRequest, id=request_id)
    if pvp_request.challenged != request.user.userprofile:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    data = json.loads(request.body)
    response = data.get('response')

    if response not in ['accept', 'reject']:
        return JsonResponse({'error': 'Invalid response'}, status=400)

    if response == 'accept':
        if pvp_request.challenger_program.is_conducting_raid or pvp_request.challenged_program.is_conducting_raid:
            return JsonResponse({'error': 'One of the programs is already in a raid'}, status=400)

        pvp_request.status = 'accepted'
        pvp_request.save()

        competition = Competition.objects.create(
            competition_type='pvp',
            status='active',
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=15)
        )

        pvp_request.challenger_program.start_raid()
        pvp_request.challenged_program.start_raid()

        Raid.objects.create(
            program=pvp_request.challenger_program,
            competition=competition,
            reward_cap=calculate_reward_cap('pvp', pvp_request.challenger_program)
        )
        Raid.objects.create(
            program=pvp_request.challenged_program,
            competition=competition,
            reward_cap=calculate_reward_cap('pvp', pvp_request.challenged_program)
        )
    else:
        pvp_request.status = 'rejected'
        pvp_request.save()

    return JsonResponse({
        'status': 'success',
        'message': f'PVP request {pvp_request.status}',
        'request_id': pvp_request.id
    })

@require_http_methods(["GET"])
@login_required
def get_active_pvp_competitions(request):
    user_profile = request.user.userprofile
    active_pvp_competitions = Competition.objects.filter(
        competition_type='pvp',
        status='active',
        raid__program__creator=user_profile
    ).distinct()

    return JsonResponse({
        'active_pvp_competitions': [
            {
                'id': comp.id,
                'start_time': comp.start_time.isoformat(),
                'end_time': comp.end_time.isoformat(),
                'participants': [
                    {
                        'public_key': raid.program.creator.public_key,
                        'program_name': raid.program.name,
                        'reward_cap': str(raid.reward_cap)
                    } for raid in comp.raid_set.all()
                ]
            } for comp in active_pvp_competitions
        ]
    })


def get_font(size):
    # This will work if Arial is installed on your system
    return ImageFont.truetype("arial.ttf", size)

def generate_image(data, card_type):
    WIDTH, HEIGHT = 800, 400
    image = Image.new('RGB', (WIDTH, HEIGHT), '#111111')
    draw = ImageDraw.Draw(image)

    # Draw border
    border_color = "#2E9245"
    draw.rectangle([0, 0, WIDTH-1, HEIGHT-1], outline=border_color, width=5)

    if card_type in ['UserCard', 'RaidCard', 'ProgramCard'] and data.get('profilePicture'):
        profile_picture = Image.open(io.BytesIO(requests.get(data['profilePicture']).content))
        profile_picture = profile_picture.resize((100, 100))
        image.paste(profile_picture, (10, 10))

    draw.text((WIDTH // 2, 50), card_type.replace('Card', ' Card'), font=get_font(30), fill="#2E9245", anchor="mm")

    if card_type == 'UserCard':
      draw.text((50, 120), f"Username: {data.get('username', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 150), f"Total Rewards: {data.get('totalRewards', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 180), f"Participated Raids: {data.get('participatedRaids', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 210), f"Engagement Score: {data.get('engagementScore', '')}", font=get_font(20), fill="#ffffff")

    if card_type == 'RaidCard':
      draw.text((50, 120), f"Program: {data.get('programName', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 150), f"Reward Cap: {data.get('rewardCap', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 180), f"Participant Count: {data.get('participantCount', '')}", font=get_font(20), fill="#ffffff")

    if card_type == 'ProgramCard':
      draw.text((50, 120), f"Program: {data.get('programName', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 150), f"Total Rewards Distributed: {data.get('totalRewardsDistributed', '')}", font=get_font(20), fill="#ffffff")
      draw.text((50, 180), f"Program Size: {data.get('size', '')}", font=get_font(20), fill="#ffffff")

    if card_type == 'LeaderboardCard':
        y_position = 120
        for index, stat in enumerate(data.get('stats', [])):
            draw.text((50, y_position), f"{index + 1}. {stat['name']}: {stat['value']}", font=get_font(20), fill="#ffffff")
            y_position += 30

    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

    return img_str

def action_user_card(request):
    user_id = request.GET.get('userId')
    logger.debug(f"Received userId: {user_id}")  # Add logging
    if not user_id:
        logger.error("User ID is required")
        return JsonResponse({'error': 'User ID is required'}, status=400)

    user_profile = get_object_or_404(UserProfile, id=user_id)
    data = {
        'username': user_profile.user.username,
        'profilePicture': user_profile.profile_picture.url if user_profile.profile_picture else None,
        'totalRewards': user_profile.total_rewards,
        'participatedRaids': user_profile.participated_raids,
        'engagementScore': user_profile.engagement_score,
    }
    logger.debug(f"User data: {data}")  # Add logging
    card_image_base64 = generate_image(data, 'UserCard')
    data['cardImage'] = card_image_base64
    return JsonResponse(data)

def action_program_card(request):
    program_id = request.GET.get('programId')
    logger.debug(f"Received programId: {program_id}")  # Add logging
    if not program_id:
        logger.error("Program ID is required")
        return JsonResponse({'error': 'Program ID is required'}, status=400)

    program = get_object_or_404(Program, id=program_id)
    data = {
        'programName': program.name,
        'profilePicture': program.profile_picture.url if program.profile_picture else None,
        'totalRewardsDistributed': program.total_rewards_distributed,
        'size': program.size,
    }
    logger.debug(f"Program data: {data}")  # Add logging
    card_image_base64 = generate_image(data, 'ProgramCard')
    data['cardImage'] = card_image_base64
    return JsonResponse(data)

def action_leaderboard_card(request):
    competition_id = request.GET.get('competitionId')
    logger.debug(f"Received competitionId: {competition_id}")  # Add logging
    if not competition_id:
        logger.error("Competition ID is required")
        return JsonResponse({'error': 'Competition ID is required'}, status=400)

    competition = get_object_or_404(Competition, id=competition_id)
    stats = [
        {'name': user.user.username, 'value': user.total_rewards}
        for user in UserProfile.objects.order_by('-total_rewards')[:10]
    ]
    data = {
        'name': competition.name,
        'stats': stats,
    }
    logger.debug(f"Leaderboard data: {data}")  # Add logging
    card_image_base64 = generate_image(data, 'LeaderboardCard')
    data['cardImage'] = card_image_base64
    return JsonResponse(data)

def action_raid_card(request):
    raid_id = request.GET.get('raidId')
    logger.debug(f"Received raidId: {raid_id}")  # Add logging
    if not raid_id:
        logger.error("Raid ID is required")
        return JsonResponse({'error': 'Raid ID is required'}, status=400)

    raid = get_object_or_404(Raid, id=raid_id)
    data = {
        'programName': raid.program.name,
        'profilePicture': raid.program.profile_picture.url if raid.program.profile_picture else None,
        'rewardCap': raid.reward_cap,
        'participantsCount': raid.participants_count,
    }
    logger.debug(f"Raid data: {data}")  # Add logging
    card_image_base64 = generate_image(data, 'RaidCard')
    data['cardImage'] = card_image_base64
    return JsonResponse(data)
