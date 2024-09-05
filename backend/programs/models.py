from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils.crypto import get_random_string
from cryptography.fernet import Fernet
import base64
from django.conf import settings
import logging
logger = logging.getLogger(__name__)

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    public_key = models.CharField(max_length=44, unique=True, null=True, blank=True)
    total_rewards = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    participated_raids = models.IntegerField(default=0)
    raid_ranking = models.IntegerField(default=0)
    engagement_score = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    streaks = models.IntegerField(default=0)
    email = models.EmailField(unique=True, null=True, blank=True)
    twitter_handle = models.CharField(max_length=50, blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
    is_email_verified = models.BooleanField(default=False)
    verification_code = models.CharField(max_length=6, blank=True)
    verification_code_expiration = models.DateTimeField(null=True, blank=True)
    token_holdings = models.DecimalField(max_digits=20, decimal_places=2, default=0.00)
    has_presale_access = models.BooleanField(default=False)
    agreed_to_terms = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)

    def __str__(self):
        return f"{self.user.username}'s profile"

    def send_verification_email(self):
        self.verification_code = get_random_string(length=6, allowed_chars='0123456789')
        self.verification_code_expiration = timezone.now() + timedelta(minutes=30)
        self.save()
        subject = 'BullPoster: Verify Your Email Address'
        html_message = render_to_string('verification_email.html', {'verification_code': self.verification_code})
        plain_message = strip_tags(html_message)
        from_email = 'admin@bullposter.xyz'
        to = self.email
        try:
            send_mail(
                subject,
                plain_message,
                from_email,
                [to],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(f"Verification email sent to {to}")
        except Exception as e:
            logger.error(f"Failed to send verification email to {to}. Error: {str(e)}")

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance, public_key=instance.username)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.userprofile.save()

class Keypair(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    public_key = models.TextField()
    encrypted_private_key = models.TextField()

    def __str__(self):
        return f"Keypair for {self.user.username}"

    def set_private_key(self, private_key):
        fernet = Fernet(base64.urlsafe_b64encode(settings.SECRET_KEY.encode()[:32]))
        self.encrypted_private_key = fernet.encrypt(private_key.encode()).decode()

    def get_private_key(self):
        fernet = Fernet(base64.urlsafe_b64encode(settings.SECRET_KEY.encode()[:32]))
        return fernet.decrypt(self.encrypted_private_key.encode()).decode()

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance, public_key=instance.username)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.userprofile.save()

class Program(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    creator = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='created_programs')
    total_rewards_distributed = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    size = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    is_conducting_raid = models.BooleanField(default=False)
    completed_raids = models.IntegerField(default=0)
    profile_picture = models.ImageField(upload_to='program_pictures/', null=True, blank=True)

    def __str__(self):
        return self.name

    def start_raid(self):
        if not self.is_conducting_raid:
            self.is_conducting_raid = True
            self.save()
            return True
        return False

    def end_raid(self):
        if self.is_conducting_raid:
            self.is_conducting_raid = False
            self.completed_raids += 1
            self.save()
            return True
        return False

class Competition(models.Model):
    COMPETITION_TYPES = [
        ('4-program', '4 Programs'),
        ('6-program', '6 Programs'),
        ('12-program', '12 Programs'),
        ('24-program', '24 Programs'),
        ('pvp', 'PvP'),
    ]
    competition_type = models.CharField(max_length=50, choices=COMPETITION_TYPES)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    participating_programs = models.ManyToManyField(Program, through='Raid')
    total_rewards_distributed = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='pending')  # 'pending', 'active', 'completed'

    def __str__(self):
        return f"{self.get_competition_type_display()} Competition"

    @property
    def required_programs(self):
        return int(self.competition_type.split('-')[0]) if self.competition_type != 'pvp' else 2

    def set_start_and_end_times(self):
        self.start_time = timezone.now() + timezone.timedelta(minutes=5)
        self.end_time = self.start_time + timezone.timedelta(minutes=15)
        self.save()

class Raid(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE)
    reward_cap = models.DecimalField(max_digits=20, decimal_places=2)
    total_rewards_distributed = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    participants_count = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.program.name} Raid in {self.competition}"

    @property
    def start_time(self):
        return self.competition.start_time

    @property
    def end_time(self):
        return self.competition.end_time

class Enrollment(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'program')

    def __str__(self):
        return f"{self.user.user.username} enrolled in {self.program.name}"

class Participation(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    raid = models.ForeignKey(Raid, on_delete=models.CASCADE)
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    engagement_score = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ('user', 'raid')

    def __str__(self):
        return f"{self.user.user.username} in {self.raid} representing {self.program.name}"

class PVPRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    challenger = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='pvp_challenges_sent')
    challenged = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='pvp_challenges_received')
    challenger_program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='pvp_challenges_sent')
    challenged_program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='pvp_challenges_received')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PVP: {self.challenger_program} vs {self.challenged_program} ({self.status})"

class PresaleData(models.Model):
    tokens_sold = models.DecimalField(max_digits=18, decimal_places=9, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Presale Data - Tokens Sold: {self.tokens_sold}"

class PreSaleTransaction(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='presale_transactions')
    sol_amount = models.DecimalField(max_digits=18, decimal_places=9)
    token_amount = models.DecimalField(max_digits=18, decimal_places=9)
    transaction_date = models.DateTimeField(auto_now_add=True)
    transaction_type = models.CharField(max_length=20, choices=[('PURCHASE', 'Purchase'), ('AIRDROP', 'Airdrop')])

    def __str__(self):
        return f"{self.user.user.username} - {self.transaction_type} - {self.token_amount} tokens"
