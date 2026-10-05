from django.urls import path
from .views import TeacherListCreateView

urlpatterns = [
    path('', TeacherListCreateView.as_view(), name='teacher-list-create'),
]