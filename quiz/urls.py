from django.urls import path
from .views import QuizView, GradeView, SubmitView, OptionView, QuestionView

urlpatterns = [

    path('quiz/', QuizView.as_view(), name='assignments'),
    path('option/', OptionView.as_view(), name='grades'),
    path('question/', QuestionView.as_view(), name='submits'),
    path('grades/', GradeView.as_view(), name='grades'),
    path('submits/', SubmitView.as_view(), name='submits'),

]
