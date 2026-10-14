from rest_framework import serializers
from .models import Assignment, Grade, Submit


class AssignmentSerializer(serializers.ModelSerializer):
    
    class_name = serializers.CharField(
        source='class_obj.name', read_only=True, allow_null=True
    )
    grade_level = serializers.IntegerField(
        source='class_obj.grade_level', read_only=True, allow_null=True
    )

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'due_date','assignment_picture',
            'teacher', 'class_obj', 'class_name', 'grade_level',
        ]
       
        read_only_fields = ['teacher']
        
        extra_kwargs = {
            'class_obj': {'required': True, 'allow_null': False}
        }


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = '__all__'
        extra_kwargs = {
            'grade': {'min_value': 0}
        }


class SubmitSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)

    class Meta:
        model = Submit
        fields = ['id', 'assignment', 'student', 'student_name', 'homework','homework_picture']
        read_only_fields = ['student']
