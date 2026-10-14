from rest_framework import serializers
from .models import Class, Attendance


class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = '__all__'
        read_only_fields = ['teacher', 'students']
        extra_kwargs = {
            'grade_level': {
                'required': True,
                'allow_null': False,
                'min_value': 1,
            }
        }


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'
        read_only_fields = ['student', 'class_obj']
