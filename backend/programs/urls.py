from django.urls import path
from . import views

urlpatterns = [
    path('presale-status/', views.presale_status, name='presale_status'),
    path('user-dashboard/<str:public_key>/', views.user_dashboard, name='user_dashboard'),
    path('creator-dashboard/<str:public_key>/', views.creator_dashboard, name='creator_dashboard'),
    path('create-program/', views.create_program, name='create_program'),
    path('update-program/<int:program_id>/', views.update_program, name='update_program'),
    path('delete-program/<int:program_id>/', views.delete_program, name='delete_program'),
    path('initiate-raid/<int:program_id>/', views.initiate_raid, name='initiate_raid'),
    path('join-raid/<int:raid_id>/', views.join_raid, name='join_raid'),
    path('raid-status/<int:raid_id>/', views.raid_status, name='raid_status'),
    path('enroll-in-program/', views.enroll_in_program, name='enroll_in_program'),
    path('available-programs/', views.available_programs, name='available_programs'),
    path('pvp-requests/', views.get_pvp_requests, name='get_pvp_requests'),
    path('send-pvp-request/', views.send_pvp_request, name='send_pvp_request'),
    path('respond-to-pvp-request/<int:request_id>/', views.respond_to_pvp_request, name='respond_to_pvp_request'),
    path('active-pvp-competitions/', views.get_active_pvp_competitions, name='get_active_pvp_competitions'),
    path('update-engagement-score/<int:participation_id>/', views.update_engagement_score, name='update_engagement_score'),
    path('check-presale-access/', views.check_presale_access, name='check_presale_access'),
    path('presale-transactions/', views.get_presale_transactions, name='get_presale_transactions'),
    path('update-profile/', views.update_user_profile, name='update_user_profile'),
    path('grant-presale-access/', views.grant_presale_access, name='grant_presale_access'),
    path('user-data/', views.get_user_data, name='get_user_data'),
    path('verify-email/', views.verify_email, name='verify_email'),
]
