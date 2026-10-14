from django.db import models
from teachers.models import Teacher
from students.models import Student


class Class(models.Model):
    name = models.CharField(max_length=100)

    grade_level = models.PositiveIntegerField(null=True, blank=True)

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE
    )

    students = models.ManyToManyField(
        Student,
        blank=True
    )

    def __str__(self):
        return self.name


class Attendance(models.Model):

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE
    )

    class_obj = models.ForeignKey(
        Class,
        on_delete=models.CASCADE
    )

    date = models.DateField()

    present = models.BooleanField()

    def __str__(self):
        return f"{self.student.name} - {self.date}"
