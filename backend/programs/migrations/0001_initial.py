# Generated by Django 5.1 on 2024-08-13 21:26

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Program',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField()),
                ('total_rewards_distributed', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('size', models.IntegerField()),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
        migrations.CreateModel(
            name='Competition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('competition_type', models.CharField(choices=[('pvp', 'PvP'), ('4-program', '4 Programs'), ('6-program', '6 Programs'), ('12-program', '12 Programs'), ('24-program', '24 Programs')], max_length=50)),
                ('start_time', models.DateTimeField()),
                ('end_time', models.DateTimeField()),
                ('total_rewards_distributed', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('participating_programs', models.ManyToManyField(to='programs.program')),
            ],
        ),
        migrations.CreateModel(
            name='Raid',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_time', models.DateTimeField()),
                ('end_time', models.DateTimeField()),
                ('reward_cap', models.DecimalField(decimal_places=2, max_digits=20)),
                ('active', models.BooleanField(default=True)),
                ('total_rewards_distributed', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('competition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='programs.competition')),
                ('program', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='programs.program')),
            ],
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_key', models.CharField(blank=True, max_length=44, null=True, unique=True)),
                ('total_rewards', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('participated_raids', models.IntegerField(default=0)),
                ('raid_ranking', models.IntegerField(default=0)),
                ('engagement_score', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('streaks', models.IntegerField(default=0)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name='program',
            name='creator',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_programs', to='programs.userprofile'),
        ),
        migrations.CreateModel(
            name='Participation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('engagement_score', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('raid', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='programs.raid')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='programs.userprofile')),
            ],
        ),
    ]