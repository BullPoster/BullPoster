from django.db import migrations, models

import django.db.models.deletion

def forwards_func(apps, schema_editor):

    Competition = apps.get_model("programs", "Competition")

    Program = apps.get_model("programs", "Program")

    Raid = apps.get_model("programs", "Raid")

    

    for competition in Competition.objects.all():

        for program in competition.participating_programs.all():

            Raid.objects.get_or_create(competition=competition, program=program)

def reverse_func(apps, schema_editor):

    Competition = apps.get_model("programs", "Competition")

    Raid = apps.get_model("programs", "Raid")

    

    for competition in Competition.objects.all():

        competition.participating_programs.set(

            [raid.program for raid in Raid.objects.filter(competition=competition)]

        )

class Migration(migrations.Migration):

    dependencies = [

        ('programs', '0006_manual_presale_and_user_updates'),

    ]

    operations = [

        migrations.RunPython(

            code=lambda apps, schema_editor: None,

            reverse_code=lambda apps, schema_editor: None,

            hints={'target_db': 'default'},

        ),

        migrations.RunPython(forwards_func, reverse_func),

        migrations.RemoveField(

            model_name='competition',

            name='participating_programs',

        ),

        migrations.AddField(

            model_name='competition',

            name='participating_programs',

            field=models.ManyToManyField(through='programs.Raid', to='programs.program'),

        ),

        migrations.AlterField(

            model_name='keypair',

            name='user',

            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='auth.user'),

        ),

    ]
