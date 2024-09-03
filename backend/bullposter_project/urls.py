from django.contrib import admin
from django.urls import path, include
from .authentication import login_view, logout_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('programs.urls')),
    path('api/auth/login/', login_view, name='auth_login'),
    path('api/auth/logout/', logout_view, name='auth_logout'),
]
