from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Quiz, Question, Option, Grade, Submit
from .serializers import (
    QuizSerializer,
    QuestionSerializer,
    OptionSerializer,
    GradeSerializer,
    SubmitSerializer,
)

from authentication.authentication import JWTAuthentication
from assignments.permissions import IsTeacher, IsStudent
from teachers.models import Teacher
from students.models import Student
class QuizView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return []

    def get(self, request):
        if request.user.role == 'teacher':
            teacher = get_object_or_404(
                Teacher, person=request.user
            )
            quizzes = Quiz.objects.filter(teacher=teacher)

        elif request.user.role == 'student':
            student = get_object_or_404(
                Student, person=request.user
            )
            quizzes = Quiz.objects.filter(
                class_obj__students=student
            )

        else:
            return Response(
                {"error": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = QuizSerializer(quizzes, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = QuizSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        teacher = get_object_or_404(
            Teacher, person=request.user
        )

        class_obj = serializer.validated_data['class_obj']

        if class_obj.teacher != teacher:
            return Response(
                {"error": "You can only create quizzes for your own classes."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer.save(teacher=teacher)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )


class QuestionView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return []

    def get(self, request):
        quiz_id = request.query_params.get('quiz_id')

        if not quiz_id:
            return Response(
                {"error": "Provide quiz_id."},
                status=status.HTTP_400_BAD_REQUEST
            )

        quiz = get_object_or_404(Quiz, id=quiz_id)

        if request.user.role == 'student':
            student = get_object_or_404(
                Student, person=request.user
            )
            if not quiz.class_obj.students.filter(id=student.id).exists():
                return Response(
                    {"error": "You are not enrolled in this class."},
                    status=status.HTTP_403_FORBIDDEN
                )

        elif request.user.role == 'teacher':
            teacher = get_object_or_404(
                Teacher, person=request.user
            )
            if quiz.teacher != teacher:
                return Response(
                    {"error": "You do not own this quiz."},
                    status=status.HTTP_403_FORBIDDEN
                )

        else:
            return Response(
                {"error": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN
            )

        questions = Question.objects.filter(quiz=quiz)
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = QuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quiz = serializer.validated_data['quiz']
        teacher = get_object_or_404(
            Teacher, person=request.user
        )

        if quiz.teacher != teacher:
            return Response(
                {"error": "You can only add questions to your own quizzes."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer.save()
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )




class OptionView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return []

    def get(self, request):
        question_id = request.query_params.get('question_id')

        if not question_id:
            return Response(
                {"error": "Provide question_id."},
                status=status.HTTP_400_BAD_REQUEST
            )

        question = get_object_or_404(
            Question, id=question_id
        )

        if request.user.role == 'teacher':
            teacher = get_object_or_404(
                Teacher, person=request.user
            )
            if question.quiz.teacher != teacher:
                return Response(
                    {"error": "You do not own this quiz."},
                    status=status.HTTP_403_FORBIDDEN
                )

        elif request.user.role == 'student':
            student = get_object_or_404(
                Student, person=request.user
            )
            if not question.quiz.class_obj.students.filter(
                id=student.id
            ).exists():
                return Response(
                    {"error": "You are not enrolled in this class."},
                    status=status.HTTP_403_FORBIDDEN
                )

            
            options = Option.objects.filter(
                question=question
            ).values('id', 'question_id', 'option_text')

            return Response(list(options))

        else:
            return Response(
                {"error": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN
            )

        options = Option.objects.filter(question=question)
        serializer = OptionSerializer(options, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        teacher = get_object_or_404(
            Teacher, person=request.user
        )

        if question.quiz.teacher != teacher:
            return Response(
                {"error": "You can only add options to your own quizzes."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer.save()
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )


class SubmitView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStudent()]
        return []

    def get(self, request):
        if request.user.role == 'teacher':
            teacher = get_object_or_404(
                Teacher, person=request.user
            )

            submits = Submit.objects.filter(
                question__quiz__teacher=teacher
            )

        elif request.user.role == 'student':
            student = get_object_or_404(
                Student, person=request.user
            )

            submits = Submit.objects.filter(
                student=student
            )

        else:
            return Response(
                {"error": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN
            )

        quiz_id = request.query_params.get('quiz_id')

        if quiz_id:
            submits = submits.filter(
                question__quiz_id=quiz_id
            )

        serializer = SubmitSerializer(
            submits,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):
        student = get_object_or_404(
            Student, person=request.user
        )

        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        selected_option = serializer.validated_data.get(
            'selected_option'
        )

        if not question.quiz.class_obj.students.filter(
            id=student.id
        ).exists():
            return Response(
                {"error": "You are not enrolled in this class."},
                status=status.HTTP_403_FORBIDDEN
            )

        if question.quiz.due_date < timezone.now():
            return Response(
                {"error": "This quiz has expired."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if selected_option and selected_option.question_id != question.id:
            return Response(
                {
                    "error": "The selected option does not belong to this question."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        existing_submission = Submit.objects.filter(
            student=student,
            question=question
         ).exists()

        if existing_submission:
           return Response(
           {"error": "You have already submitted this quiz."},
           status=status.HTTP_400_BAD_REQUEST
    )

        submission = Submit.objects.create(
            student=student,
            question=question,
            selected_option=selected_option
        )

        return Response(
          SubmitSerializer(submission).data,
          status=status.HTTP_201_CREATED
)   



class GradeView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return [IsTeacher()]
        return []

    def get(self, request):
        if request.user.role == 'student':
            student = get_object_or_404(
                Student, person=request.user
            )
            grades = Grade.objects.filter(student=student)

        elif request.user.role == 'teacher':
            teacher = get_object_or_404(
                Teacher, person=request.user
            )
            grades = Grade.objects.filter(
                question__quiz__teacher=teacher
            )

        else:
            return Response(
                {"error": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = GradeSerializer(grades, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = GradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        student = serializer.validated_data['student']
        grade = serializer.validated_data['grade']

        teacher = get_object_or_404(
            Teacher, person=request.user
        )

        if question.quiz.teacher != teacher:
            return Response(
                {"error": "You can only grade your own quizzes."},
                status=status.HTTP_403_FORBIDDEN
            )

        if not question.quiz.class_obj.students.filter(
            id=student.id
        ).exists():
            return Response(
                {"error": "This student is not enrolled in the quiz class."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if grade > question.marks:
            return Response(
                {"error": f"Marks cannot exceed {question.marks}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        grade_obj, created = Grade.objects.update_or_create(
            question=question,
            student=student,
            defaults={'grade': grade}
        )

        return Response(
            GradeSerializer(grade_obj).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )