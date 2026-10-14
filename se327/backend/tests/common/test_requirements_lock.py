import re
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


def pins(path):
    found = {}
    for line in path.read_text().splitlines():
        match = re.match(r'^([A-Za-z0-9_.-]+)==([^\s\;]+)', line)
        if match:
            found[match.group(1).lower().replace('_', '-')] = match.group(2)
    return found


class RequirementsLockTests(SimpleTestCase):
    def test_lock_matches_requirements(self):
        wanted = pins(Path(settings.BASE_DIR) / 'requirements.txt')
        locked = pins(Path(settings.BASE_DIR) / 'requirements.lock')
        for name, version in wanted.items():
            self.assertEqual(locked.get(name), version, f'{name} differs, regenerate requirements.lock')
