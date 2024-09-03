import json
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth import login as auth_login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from programs.models import UserProfile

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body)
        public_key = data.get('publicKey')

        if not public_key:
            return JsonResponse({'error': 'Missing public key'}, status=400)

        user, created = User.objects.get_or_create(username=public_key)
        if created:
            user.set_unusable_password()
            user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if not profile.public_key:
            profile.public_key = public_key
        profile.save()

        auth_login(request, user)
        return JsonResponse({'isAuthenticated': True, 'username': user.username})
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JsonResponse({'error': 'An unexpected error occurred'}, status=500)

@require_http_methods(["POST"])
@login_required
def logout_view(request):
    logout(request)
    return JsonResponse({'success': True})

def auth_required(view_func):
    return login_required(view_func, login_url=None)
