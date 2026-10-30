from django.db import models
from students.models import Student
from teachers.models import Teacher


class Quiz(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        blank=False,
        null=False
    )

    class_obj = models.ForeignKey(
        'classes.Class',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    def __str__(self):
        return self.title


class Question(models.Model):
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='questions'
    )

    question_text = models.TextField()

    question_picture = models.ImageField(
        upload_to='question_pictures/',
        blank=True,
        null=True
    )

    marks = models.PositiveIntegerField(default=1)

    def __str__(self):
        return self.question_text[:50]


class Option(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='options'
    )

    option_text = models.CharField(max_length=200)

    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.option_text


class Grade(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE
    )

    student = models.ForeignKey(
    Student,
    on_delete=models.CASCADE,
    related_name='quiz_grades'
    )
    grade = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.student_id} - {self.question_id}"


class Submit(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE
    )

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='quiz_submissions'
    )

    selected_options = models.ManyToManyField(
        Option,
        blank=False,
        related_name='submissions'
    )

    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'question'],
                name='unique_student_question_submission'
            )
        ]

    def __str__(self):
        return f"{self.student_id} - {self.question_id}"