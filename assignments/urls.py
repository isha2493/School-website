from django.urls import path
from .views import AssignmentView, GradeView, SubmitView

urlpatterns = [

    path('assignments/', AssignmentView.as_view(), name='assignments'),

    path('grades/', GradeView.as_view(), name='grades'),
    path('submits/', SubmitView.as_view(), name='submits'),

]
