from django.urls import path
from .views import (
    ClassView,
    JoinClassView,
    ClassStudentsView,
    RemoveStudentView,
    AttendanceView
)

urlpatterns = [
    path('', ClassView.as_view(), name='classes'),
    path('join/', JoinClassView.as_view(), name='join-class'),
    path(
        '<int:class_id>/students/',
        ClassStudentsView.as_view(),
        name='class-students'
    ),
    path(
        '<int:class_id>/students/<int:student_id>/',
        RemoveStudentView.as_view(),
        name='remove-student'
    ),
    path(
        'attendance/',
        AttendanceView.as_view(),
        name='attendance'
    ),
]
