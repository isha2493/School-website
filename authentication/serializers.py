
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import Person
from students.models import Student
from teachers.models import Teacher
from parents.models import Parent


class PersonSerializer(serializers.ModelSerializer):

    student_class = serializers.IntegerField(required=False)
    child = serializers.IntegerField(required=False)

    class Meta:
        model = Person
        fields = [
            'username',
            'email',
            'password',
            'role',
            'roll_no',
            'student_class',
            'child',
            'profile_picture'
        ]

        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):

        student_class = validated_data.pop(
            'student_class',
            None
        )

        child = validated_data.pop(
            'child',
            None
        
        )

        validated_data['password'] = make_password(
            validated_data['password']
        )

        person = Person.objects.create(
            **validated_data
        )

        if person.role == 'student':
            Student.objects.create(
                person=person,
                name=person.username,
                student_class=student_class,
                roll_no=person.roll_no,
                email=person.email
            )

        elif person.role == 'teacher':
            Teacher.objects.create(
                person=person,
                name=person.username,
                email=person.email
            )

        elif person.role == 'parent':
            Parent.objects.create(
                person=person,
                name=person.username,
                email=person.email,
                child_id=child,
                
            )

        return person

