from django.db import models


class Person(models.Model):
    username = models.CharField(max_length=100)
    email = models.EmailField()
    password = models.CharField(
        max_length=120,
        blank=True,
        null=True
    )

    ROLE_CHOICES = [
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('parent', 'Parent'),
    ]

    roll_no = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES
    )

    def __str__(self):
        return self.username