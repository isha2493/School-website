
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

    def validate_role(self, value):
      if value in ['student', 'parent']:
        raise serializers.ValidationError(
            "Students and parents must be registered by a teacher."
        )
      return value

    def create(self, validated_data):
        validated_data.pop('student_class', None)
        child = validated_data.pop('child', None)

        validated_data['password'] = make_password(
            validated_data['password']
        )

        person = Person.objects.create(**validated_data)

        if person.role == 'teacher':
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
                child_id=child
            )

        return person


class StudentRegistrationSerializer(serializers.ModelSerializer):

    student_class = serializers.IntegerField()

    class Meta:
        model = Person
        fields = [
            'username',
            'email',
            'password',
            'roll_no',
            'student_class',
            'profile_picture'
        ]

        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        student_class = validated_data.pop('student_class')

        validated_data['password'] = make_password(
            validated_data['password']
        )
        validated_data['role'] = 'student'

        person = Person.objects.create(**validated_data)

        Student.objects.create(
            person=person,
            name=person.username,
            student_class=student_class,
            roll_no=person.roll_no,
            email=person.email
        )

        return person


class ParentRegistrationSerializer(serializers.ModelSerializer):

    child = serializers.IntegerField(required=False)

    class Meta:
        model = Person
        fields = [
            'username',
            'email',
            'password',
            'child',
            'profile_picture'
        ]

        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        child = validated_data.pop('child', None)

        validated_data['password'] = make_password(
            validated_data['password']
        )
        validated_data['role'] = 'parent'

        person = Person.objects.create(**validated_data)

        Parent.objects.create(
            person=person,
            name=person.username,
            email=person.email,
            child_id=child
        )

        return person
