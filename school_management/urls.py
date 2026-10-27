from django.contrib import admin
from django.urls import path, include
from django.shortcuts import render, redirect
from django.conf import settings
from django.conf.urls.static import static


def home(request):
    return redirect('login-page')


def login_page(request):
    return render(request, 'login.html')


def register_page(request):
    return render(request, 'register.html')


def dashboard_page(request, role):
    if role not in ['student', 'teacher', 'parent']:
        return redirect('login-page')

    return render(request, f'{role}_dashboard.html')


def notices_page(request):
    return render(request, 'notices.html')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home, name='home'),
    path('login/', login_page, name='login-page'),
    path('register/', register_page, name='register-page'),
    path(
        '<str:role>-dashboard/',
        dashboard_page,
        name='dashboard-page'
    ),
    path('notices/', notices_page, name='notices-page'),

    
    path('api/students/', include('students.urls')),
    path('api/parents/', include('parents.urls')),
    path('api/teachers/', include('teachers.urls')),
    path('api/auth/', include('authentication.urls')),
    path('api/assignments/', include('assignments.urls')),
    path('api/class/', include('classes.urls')),
    path('api/notices/', include('notices.urls')),
    path('api/quiz/', include('quiz.urls')),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)