from django.urls import path
from .views import StudentListCreateView, StudentCSVUploadView


urlpatterns = [
    path('', StudentListCreateView.as_view(), name='student-list-create'),
    
    path('registerstud', StudentCSVUploadView.as_view(), name='student-CSV-upload-View')
]