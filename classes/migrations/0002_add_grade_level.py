



from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='class',
            name='grade_level',
            field=models.PositiveIntegerField(
                null=True,
                blank=True,
            ),
        ),
    ]
