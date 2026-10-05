from django.urls import path
from .views import StudentListCreateView

urlpatterns = [
    path('', StudentListCreateView.as_view(), name='student-list-create'),
]