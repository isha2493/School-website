from django.urls import path
from .views import ParentListCreateView

urlpatterns = [
    path('', ParentListCreateView.as_view(), name='parent-list-create'),
]