from django.utils import timezone
from .models import Raid, UserProfile, Program, Competition, Participation

def distribute_rewards(raid):
    participants = Participation.objects.filter(raid=raid)
    total_engagement = sum(p.engagement_score for p in participants)
    
    if total_engagement == 0:
        return  # No engagement, no rewards to distribute

    for participation in participants:
        user_profile = participation.user.userprofile
        user_share = (participation.engagement_score / total_engagement) * raid.reward_cap
        user_profile.total_rewards += user_share
        user_profile.participated_raids += 1
        user_profile.save()

    raid.total_rewards_distributed = raid.reward_cap
    raid.active = False
    raid.save()

    raid.program.total_rewards_distributed += raid.reward_cap
    raid.program.save()

    raid.competition.total_rewards_distributed += raid.reward_cap
    raid.competition.save()

def calculate_reward_cap(competition_type, program):
    elapsed_hours = max((timezone.now() - program.created_at).total_seconds() / 3600, 1)
    avg_rewards_per_hour = program.total_rewards_distributed / elapsed_hours
    
    base_cap = {
        'pvp': 1000,
        '4-program': 2000,
        '6-program': 3000,
        '12-program': 4000,
        '24-program': 5000
    }.get(competition_type, 1000)
    
    calculated_cap = max(min(avg_rewards_per_hour * 0.5, base_cap), 100)
    return calculated_cap

def track_inflation():
    last_hour = timezone.now() - timezone.timedelta(hours=1)
    recent_raids = Raid.objects.filter(active=False, end_time__gte=last_hour)
    total_rewards_last_hour = sum(raid.total_rewards_distributed for raid in recent_raids)
    inflation_threshold = 50000  # Example threshold; adjust as necessary
    if total_rewards_last_hour > inflation_threshold:
        active_raids = Raid.objects.filter(active=True)
        for raid in active_raids:
            raid.reward_cap *= 0.9  # Decrease cap to manage inflation
            raid.save()
