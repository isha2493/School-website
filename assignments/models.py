from django.db import models
from students.models import Student
from teachers.models import Teacher


class Assignment(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    due_date = models.DateField()
    assignment_picture = models.ImageField(
      upload_to='assignment_pictures/',
      blank=True,
      null=True
    )


    
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    class_obj = models.ForeignKey(
        'classes.Class',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    def __str__(self):
        return self.title


class Grade(models.Model):

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE
    )

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE
    )

    grade = models.IntegerField()

    def __str__(self):
        return f"{self.student.name} - {self.assignment.title}"


class Submit(models.Model):

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE
    )

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE
    )
    homework = models.TextField()
    homework_picture = models.ImageField(
    upload_to='homework_pictures/',
    blank=True,
    null=True
    )


    def __str__(self):
        return f"{self.student.name} - {self.assignment.title}"
