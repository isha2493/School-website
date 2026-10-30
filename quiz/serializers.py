from rest_framework import serializers
from .models import Quiz, Option,Question, Grade, Submit


class QuizSerializer(serializers.ModelSerializer):
    
    class_name = serializers.CharField(
        source='class_obj.name', read_only=True, allow_null=True
    )
    grade_level = serializers.IntegerField(
        source='class_obj.grade_level', read_only=True, allow_null=True
    )

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'description', 'due_date','created_at',
            'teacher', 'class_obj', 'class_name', 'grade_level',
        ]
       
        read_only_fields = ['teacher']
        
        extra_kwargs = {
            'class_obj': {'required': True, 'allow_null': False}
        }

class QuestionSerializer(serializers.ModelSerializer):
     class Meta:
         model=Question
         fields = "__all__"

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model=Option
        fields='__all__'
        extra_kwargs = {
                    'option_text':  {'allow_blank': False}
                }

class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['question','student','grade']
        extra_kwargs = {
            'grade': {'min_value': 0}
        }


from rest_framework import serializers
from .models import Submit, Option


class SubmitSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(
        source='student.person.username',
        read_only=True
    )

    selected_options = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Option.objects.all(),
        allow_empty=False
    )

    class Meta:
        model = Submit
        fields = [
            'id',
            'student',
            'student_name',
            'question',
            'selected_options',
            'submitted_at'
        ]

        read_only_fields = ['student', 'submitted_at']

