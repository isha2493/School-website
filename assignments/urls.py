from django.urls import path
from .views import AssignmentView

urlpatterns = [
    path('', AssignmentView.as_view(), name='assignments'),
]