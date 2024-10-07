from django.urls import path
from . import views

urlpatterns = [
    path('presale-status/', views.presale_status, name='presale_status'),
    path('upload-program-picture/', views.upload_program_picture, name='upload_program_picture'),
    path('update-program/<int:program_id>/', views.update_program, name='update_program'),
    path('delete-program/<int:program_id>/', views.delete_program, name='delete_program'),
    path('join-raid/<int:raid_id>/', views.join_raid, name='join_raid'),
    path('respond-to-pvp-request/<int:request_id>/', views.respond_to_pvp_request, name='respond_to_pvp_request'),
    path('check-presale-access/', views.check_presale_access, name='check_presale_access'),
    path('presale-transactions/', views.get_presale_transactions, name='get_presale_transactions'),
    path('upload-profile-picture/', views.upload_profile_picture, name='upload_profile_picture'),
    path('grant-presale-access/', views.grant_presale_access, name='grant_presale_access'),
    path('verify-email/', views.verify_email, name='verify_email'),
    path('user-card/', views.action_user_card, name='action_user_card'),
    path('program-card/', views.action_program_card, name='action_program_card'),
    path('leaderboard-card/', views.action_leaderboard_card, name='action_leaderboard_card'),
    path('raid-card/', views.action_raid_card, name='action_raid_card'),
]
