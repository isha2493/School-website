from django.urls import path
from .views import LoginView, TeacherRegisterView, ProfileView, ProfileUpdateView,StudentRegisterView, ParentRegisterView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('teacher/register/', TeacherRegisterView.as_view(), name='register'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/update/', ProfileUpdateView.as_view(), name='profile-update'),
    path('students/register/',StudentRegisterView.as_view(),name='student-register'),
    path('parents/register/',ParentRegisterView.as_view(),name='student-register'),
    
]