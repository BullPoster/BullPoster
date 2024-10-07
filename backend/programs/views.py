from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count, Q
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib.auth.models import User
from .models import UserProfile, Raid, Participation, Competition, Program, Enrollment, PVPRequest, PresaleData, PreSaleTransaction, Keypair
from datetime import timedelta
from solders.keypair import Keypair as SolanaKeypair
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps, ImageChops
import imgkit
from jinja2 import Template
import requests
import io
import os
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
@require_http_methods(["POST"])
def upload_profile_picture(request):
    data = json.loads(request.body)
    user = request.user

    if 'profile_picture' in request.FILES:
        profile_picture = request.FILES['profile_picture']
        if profile_picture.content_type != 'image/png':
            return JsonResponse({'error': 'Only PNG images are allowed'}, status=400)

        # Resize the image to 100x100
        image = Image.open(profile_picture)
        image = image.resize((100, 100), Image.LANCZOS)
        image_io = io.BytesIO()
        image.save(image_io, format='PNG')
        image_io.seek(0)

        # Save the image in the user_pfp folder with the username as the filename
        folder_name = 'user_pfp'
        folder_path = os.path.join(settings.MEDIA_ROOT, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        image_path = os.path.join(folder_path, f"{user.username}.png")
        with open(image_path, 'wb') as f:
            f.write(image_io.getbuffer())

    return JsonResponse({'status': 'success'})

@require_http_methods(["POST"])
@login_required
@csrf_exempt
def upload_program_picture(request):
    raid_program_account_public_key = request.POST.get('raidProgramAccountPublicKey')
    if not raid_program_account_public_key:
        return JsonResponse({'error': 'Raid program account public key is required'}, status=400)

    if 'profile_picture' in request.FILES:
        profile_picture = request.FILES['profile_picture']
        if profile_picture.content_type != 'image/png':
            return JsonResponse({'error': 'Only PNG images are allowed'}, status=400)

        # Resize the image to 100x100
        image = Image.open(profile_picture)
        image = image.resize((100, 100), Image.LANCZOS)
        image_io = io.BytesIO()
        image.save(image_io, format='PNG')
        image_io.seek(0)

        # Save the image in the program_pfp folder with the raid program account public key as the filename
        folder_name = 'program_pfp'
        folder_path = os.path.join(settings.MEDIA_ROOT, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        image_path = os.path.join(folder_path, f"{raid_program_account_public_key}.png")
        with open(image_path, 'wb') as f:
            f.write(image_io.getbuffer())

        return JsonResponse({'status': 'success', 'message': 'Profile picture uploaded successfully'})
    else:
        return JsonResponse({'error': 'No profile picture provided'}, status=400)

@require_http_methods(["PUT"])
@login_required
@csrf_exempt
def update_program(request, program_id):
    user = request.user
    user_profile, _ = UserProfile.objects.get_or_create(user=user)
    program = get_object_or_404(Program, id=program_id, creator=user_profile)

    if request.content_type == 'application/json':
        data = json.loads(request.body)
        if data.get('name'):
            program.name = data['name']
        if data.get('description'):
            program.description = data['description']
    else:
        if request.POST.get('name'):
            program.name = request.POST['name']
        if request.POST.get('description'):
            program.description = request.POST['description']
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

def generate_card_html(data, card_type):
    template = Template("""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
            body, html {
                width: 400px;
                height: 400px;
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            .card {
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                padding: 15px;
                font-family: 'Orbitron', sans-serif;
                background: linear-gradient(135deg, #1a1c20, #2C2F33);
                color: white;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.1);
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .card::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
                transform: rotate(30deg);
                z-index: 0;
            }
            .card-section {
                position: relative;
                z-index: 1;
                width: 100%;
                padding: 0 10px;
                box-sizing: border-box;
            }
            .title-section {
                text-align: center;
            }
            .card-title {
                font-size: 28px;
                font-weight: bold;
                padding: 5px 0;
                background: linear-gradient(to right, #FFD700, #FFA500);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                position: relative;
                display: inline-block;
            }
            .card-title::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 2px;
                background: linear-gradient(to right, #FFD700, #FFA500);
            }
            .profile-section {
                display: flex;
                align-items: center;
            }
            .profile-picture {
                width: 70px;
                height: 70px;
                border-radius: 50%;
                margin-right: 15px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                border: 2px solid rgba(255,255,255,0.3);
            }
            .profile-info {
                flex-grow: 1;
            }
            .profile-name {
                font-size: 22px;
                font-weight: bold;
                margin-bottom: 5px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            }
            .profile-subtitle {
                font-size: 14px;
                color: #FFD700;
                display: flex;
                align-items: center;
            }
            .rank-icon {
                width: 18px;
                height: 18px;
                margin-right: 5px;
            }
            .stats-container {
                display: flex;
                justify-content: space-between;
                width: 100%;
            }
            .stat-box {
                flex: 0 0 25%;  /* Default for 3 boxes: flex-grow: 0, flex-shrink: 0, flex-basis: 25% */
                max-width: 25%;
                padding: 8px;
                background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.1);
            }
            .stats-container.four-stats .stat-box {
                flex-basis: 18.5%;  /* Adjust for 4 boxes */
                max-width: 18.5%;
            }
            .stat-circle {
                width: 70px;
                height: 70px;
                margin: 0 auto 8px;
                position: relative;
            }
            .stat-circle::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: conic-gradient(
                    var(--stat-color) var(--stat-angle),
                    rgba(255,255,255,0.1) var(--stat-angle)
                );
                clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%);
            }
            .stat-circle::after {
                content: '';
                position: absolute;
                top: 5px;
                left: 5px;
                right: 5px;
                bottom: 5px;
                border-radius: 50%;
                background: #2C2F33;
            }
            .stat-value {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 18px;
                font-weight: bold;
                z-index: 1;
            }
            .stat-icon {
                width: 22px;
                height: 22px;
                margin: 5px auto;
            }
            .stat-label {
                font-size: 12px;
                color: #ADB5BD;
                margin-top: 4px;
            }
            .footer-section {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                padding: 5px 10px;
            }
            .powered-by {
                font-size: 12px;
                font-weight: bold;
                color: #FFFFFF;
                margin-right: 5px;
                text-shadow: 0 0 5px rgba(255,255,255,0.5);
            }
            .logo {
                width: 100px;
                height: auto;
            }
            .leaderboard {
                margin-top: 15px;
            }
            .leaderboard-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 6px;
                background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
                border-radius: 5px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            .leaderboard-item:nth-child(even) {
                background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="card-section title-section">
                <div class="card-title">{{ card_type }} Card</div>
            </div>
            {% if card_type in ['User', 'Program', 'Raid'] %}
                <div class="card-section profile-section">
                    <img src="{{ data.profilePicture or 'https://bullposter.xyz/media/user_pfp/default.png' }}" class="profile-picture" alt="Profile Picture">
                    <div class="profile-info">
                        <div class="profile-name">
                            {% if data.username %}
                                {{ data.username[:4] }}...{{ data.username[-4:] }}
                            {% else %}
                                {{ data.programName }}
                            {% endif %}
                        </div>
                        {% if card_type == 'User' %}
                            <div class="profile-subtitle">
                                <img src="{{ data.rankingIconUrl }}" class="rank-icon" alt="Rank">
                                Rank: {{ data.ranking }} of {{ data.totalUsers }}
                            </div>
                        {% elif card_type == 'Program' %}
                            <div class="profile-subtitle">
                                <img src="https://bullposter.xyz/media/icons/rank.png" class="rank-icon" alt="Rank">
                                Rank: {{ data.ranking }} of {{ data.totalPrograms }}
                            </div>
                        {% elif card_type == 'Raid' %}
                            <div class="profile-subtitle">Participants: {{ data.participantsCount }}</div>
                        {% endif %}
                    </div>
                </div>
                <div class="card-section">
                    <div class="stats-container {% if data.stats|length == 4 %}four-stats{% endif %}">
                        {% for item in data.stats %}
                            <div class="stat-box">
                                <div class="stat-circle" style="--stat-color: {{ item.color }}; --stat-angle: {{ (item.value|float / 25) * 90 }}deg;">
                                    <div class="stat-value">{{ item.value }}</div>
                                </div>
                                <img src="{{ item.iconUrl }}" class="stat-icon" alt="{{ item.label }}">
                                <div class="stat-label">{{ item.label }}</div>
                            </div>
                        {% endfor %}
                    </div>
                </div>
            {% elif card_type == 'Leaderboard' %}
                <div class="leaderboard">
                    {% for item in data.stats[:10] %}
                        <div class="leaderboard-item">
                            <span>{{ loop.index }}. {{ item.name[:4] }}...{{ item.name[-4:] }}</span>
                            <span>{{ item.value }}</span>
                        </div>
                    {% endfor %}
                </div>
            {% endif %}
            <div class="card-section footer-section">
                <span class="powered-by">Powered By</span>
                <img src="https://bullposter.xyz/media/logo.png" alt="BullPoster Logo" class="logo">
            </div>
        </div>
    </body>
    </html>
    """)

    return template.render(data=data, card_type=card_type)

def generate_image(data, card_type, image_name):
    html_content = generate_card_html(data, card_type)

    folder_name = f"{card_type.lower()}_card"
    folder_path = os.path.join(settings.MEDIA_ROOT, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    image_path = os.path.join(folder_path, image_name)

    options = {
        'width': 400,
        'height': 400,
        'quality': 100,
    }

    imgkit.from_string(html_content, image_path, options=options)

    return f"{folder_name}/{image_name}"

@csrf_exempt
def action_user_card(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    required_fields = ['username', 'profilePicture', 'ranking', 'totalUsers', 'totalRewards', 'participatedRaids', 'engagementScore']
    for field in required_fields:
        if field not in data:
            return JsonResponse({'error': f'Missing required field: {field}'}, status=400)

    logger.debug(f"Received user data: {data}")

    processed_data = {
        'username': data['username'],
        'profilePicture': data['profilePicture'],
        'ranking': int(data['ranking']),
        'totalUsers': int(data['totalUsers']),
        'rankingIconUrl': 'https://bullposter.xyz/media/icons/rank.png',
        'stats': [
            {
                'label': 'Total Rewards',
                'value': int(data['totalRewards']),
                'color': '#FFD700',
                'iconUrl': 'https://bullposter.xyz/media/icons/reward.png'
            },
            {
                'label': 'Participated Raids',
                'value': int(data['participatedRaids']),
                'color': '#8A2BE2',
                'iconUrl': 'https://bullposter.xyz/media/icons/raid.png'
            },
            {
                'label': 'Engagement Score',
                'value': int(data['engagementScore']),
                'color': '#4CAF50',
                'iconUrl': 'https://bullposter.xyz/media/icons/engagement.png'
            }
        ]
    }

    logger.debug(f"Processed user data: {processed_data}")
    image_name = f"user_card_{data['username']}.png"
    relative_image_path = generate_image(processed_data, 'User', image_name)
    processed_data['cardImage'] = relative_image_path

    return JsonResponse(processed_data)

@csrf_exempt
def action_program_card(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)

    try:
        data = json.loads(request.body)
        logger.error(f"Received data: {data}")  # Log received data for debugging

        required_fields = [
            'raidProgramAccountPublicKey', 'name', 'description', 'profilePictureUrl',
            'size', 'totalRewardsDistributed', 'totalRaidWins', 'totalRaidsPartaken', 'programRank', 'totalPrograms'
        ]

        missing_fields = [field for field in required_fields if field not in data or data[field] is None]

        if missing_fields:
            logger.error(f"Missing required fields: {', '.join(missing_fields)}")
            return JsonResponse({'error': f"Missing required fields: {', '.join(missing_fields)}"}, status=400)

        image_data = {
            'programName': data['name'],
            'description': data['description'],
            'profilePicture': data['profilePictureUrl'],
            'ranking': data['programRank'],
            'totalPrograms': data['totalPrograms'],
            'stats': [
                {
                    'label': 'Size',
                    'value': data['size'],
                    'color': '#4CAF50',
                    'iconUrl': 'https://bullposter.xyz/media/icons/size.png'
                },
                {
                    'label': 'Total Rewards',
                    'value': data['totalRewardsDistributed'],
                    'color': '#FFD700',
                    'iconUrl': 'https://bullposter.xyz/media/icons/reward.png'
                },
                {
                    'label': 'Raids Won',
                    'value': data['totalRaidWins'],
                    'color': '#1E90FF',
                    'iconUrl': 'https://bullposter.xyz/media/icons/wins.png'
                },
                {
                    'label': 'Raids Partaken',
                    'value': data['totalRaidsPartaken'],
                    'color': '#FF4500',
                    'iconUrl': 'https://bullposter.xyz/media/icons/partaken.png'
                }
            ]
        }

        logger.debug(f"Processed image_data: {image_data}")  # Log processed data for debugging

        image_name = f"program_card_{data['raidProgramAccountPublicKey']}.png"
        relative_image_path = generate_image(image_data, 'Program', image_name)
        image_data['cardImage'] = relative_image_path

        return JsonResponse(image_data)

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON: {str(e)}")
        return JsonResponse({'error': 'Invalid JSON', 'details': str(e)}, status=400)
    except Exception as e:
        logger.error(f"Error in action_program_card: {str(e)}", exc_info=True)
        return JsonResponse({'error': 'An unexpected error occurred', 'details': str(e)}, status=500)

def action_raid_card(request):
    raid_id = request.GET.get('raidId')
    logger.debug(f"Received raidId: {raid_id}")
    if not raid_id:
        logger.error("Raid ID is required")
        return JsonResponse({'error': 'Raid ID is required'}, status=400)

    raid = get_object_or_404(Raid, id=raid_id)
    data = {
        'programName': raid.program.name,
        'profilePicture': raid.program.profile_picture.url if raid.program.profile_picture else None,
        'participantsCount': raid.participants_count,
        'stats': [
            {
                'label': 'Reward Cap',
                'value': raid.reward_cap,
                'color': '#FFD700',
                'iconUrl': 'https://bullposter.xyz/media/icons/reward.png'
            },
            {
                'label': 'Participants',
                'value': raid.participants_count,
                'color': '#4CAF50',
                'iconUrl': 'https://bullposter.xyz/media/icons/participants.png'
            }
        ]
    }
    logger.debug(f"Raid data: {data}")
    image_name = f"raid_card_{raid.id}.png"
    relative_image_path = generate_image(data, 'Raid', image_name)
    data['cardImage'] = relative_image_path
    return JsonResponse(data)

def action_leaderboard_card(request):
    competition_id = request.GET.get('competitionId')
    logger.debug(f"Received competitionId: {competition_id}")
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
    logger.debug(f"Leaderboard data: {data}")
    image_name = f"leaderboard_card_{competition.id}.png"
    relative_image_path = generate_image(data, 'Leaderboard', image_name)
    data['cardImage'] = relative_image_path
    return JsonResponse(data)
