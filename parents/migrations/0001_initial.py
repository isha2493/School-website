

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Parent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('child_name', models.CharField(max_length=100)),
                ('child_class', models.IntegerField()),
                ('email', models.EmailField(max_length=254)),
            ],
        ),
    ]
