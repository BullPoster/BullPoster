from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('programs', '0002_remove_raid_active_participation_program_and_more'),  # Make sure this matches your last good migration
    ]

    operations = [
        migrations.RemoveField(
            model_name='raid',
            name='end_time',
        ),
        migrations.RemoveField(
            model_name='raid',
            name='start_time',
        ),
        migrations.RemoveField(
            model_name='raid',
            name='status',
        ),
        migrations.AddField(
            model_name='competition',
            name='status',
            field=models.CharField(default='pending', max_length=20),
        ),
        migrations.AddField(
            model_name='program',
            name='completed_raids',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='competition',
            name='competition_type',
            field=models.CharField(choices=[('4-program', '4 Programs'), ('6-program', '6 Programs'), ('12-program', '12 Programs'), ('24-program', '24 Programs')], max_length=50),
        ),
        migrations.AlterField(
            model_name='competition',
            name='end_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='competition',
            name='start_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Do not include any operations that alter the ManyToMany field
    ]
