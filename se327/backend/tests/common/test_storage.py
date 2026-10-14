import json
import tempfile
import urllib.error
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings

from common import storage

JPEG = b'\xff\xd8\xff\xe0' + b'0' * 20
PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 20
WEBP = b'RIFF\x10\x00\x00\x00WEBP' + b'0' * 20


def upload(content=JPEG, name='photo.jpg'):
    return SimpleUploadedFile(name, content, content_type='image/jpeg')


class StorageCase(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = mock.patch.dict('os.environ', {'MEDIA_DIR': self.tmp.name, 'MEDIA_URL': '/files'})
        patcher.start()
        self.addCleanup(patcher.stop)


class SaveTests(StorageCase):
    def test_save_returns_url_and_path(self):
        stored = storage.save_image(upload(), 'products')
        self.assertEqual(stored.bucket_name, 'local')
        self.assertRegex(stored.file_path, r'^products/[0-9a-f]{32}\.jpg$')
        self.assertEqual(stored.public_url, f'/files/{stored.file_path}')
        self.assertEqual((Path(self.tmp.name) / stored.file_path).read_bytes(), JPEG)

    def test_unique_names_and_client_name_ignored(self):
        first = storage.save_image(upload(name='../../evil.php'), 'products')
        second = storage.save_image(upload(name='../../evil.php'), 'products')
        self.assertNotEqual(first.file_path, second.file_path)
        self.assertNotIn('evil', first.file_path)

    def test_extension_comes_from_content(self):
        self.assertTrue(storage.save_image(upload(PNG, 'a.jpg'), 'p').file_path.endswith('.png'))
        self.assertTrue(storage.save_image(upload(WEBP, 'a.png'), 'p').file_path.endswith('.webp'))

    def test_wrong_type_rejected(self):
        for content in (b'GIF89a' + b'0' * 20, b'<?php echo 1; ?>', b'', b'RIFF\x10\x00\x00\x00WAVE'):
            with self.assertRaises(storage.ImageRejected) as caught:
                storage.save_image(upload(content), 'products')
            self.assertEqual((caught.exception.status, caught.exception.code), (400, 'INVALID_FILE_TYPE'))

    def test_oversize_rejected(self):
        with self.assertRaises(storage.ImageRejected) as caught:
            storage.save_image(upload(JPEG + b'0' * storage.MAX_IMAGE_BYTES), 'products')
        self.assertEqual((caught.exception.status, caught.exception.code), (413, 'FILE_TOO_LARGE'))
        self.assertEqual(list(Path(self.tmp.name).iterdir()), [])

    def test_exactly_max_size_ok(self):
        size = storage.MAX_IMAGE_BYTES
        self.assertTrue(storage.save_image(upload(JPEG + b'0' * (size - len(JPEG))), 'p'))

    def test_write_failure_becomes_storage_error(self):
        with mock.patch('common.storage.open', side_effect=OSError('disk full'), create=True):
            with self.assertRaises(storage.StorageError):
                storage.save_image(upload(), 'products')

    def test_partial_write_is_removed(self):
        class Failing(SimpleUploadedFile):
            def chunks(self, chunk_size=None):
                yield JPEG
                raise OSError('disk full')

        with self.assertRaises(storage.StorageError):
            storage.save_image(Failing('a.jpg', JPEG), 'products')
        self.assertEqual([p for p in Path(self.tmp.name).rglob('*') if p.is_file()], [])

    def test_default_url_and_root(self):
        with mock.patch.dict('os.environ', {}, clear=True):
            self.assertEqual(storage.media_url(), '/media/')
            self.assertEqual(storage.media_root().name, 'media')
        with mock.patch.dict('os.environ', {'CAMPAIGN_MEDIA_URL': 'https://cdn.test/m'}, clear=True):
            self.assertEqual(storage.media_url(), 'https://cdn.test/m/')


class DeleteTests(StorageCase):
    def test_delete_removes_file(self):
        stored = storage.save_image(upload(), 'products')
        storage.delete_files([stored.file_path])
        self.assertFalse((Path(self.tmp.name) / stored.file_path).exists())

    def test_delete_missing_file_is_silent(self):
        storage.delete_files(['products/none.jpg'])

    def test_no_path_traversal(self):
        outside = Path(self.tmp.name).parent / 'outside-file.txt'
        outside.write_text('keep')
        self.addCleanup(outside.unlink)
        storage.delete_files(['../outside-file.txt'])
        self.assertTrue(outside.exists())

    def test_delete_error_is_swallowed(self):
        with mock.patch.object(Path, 'unlink', side_effect=OSError):
            storage.delete_files(['products/a.jpg'])


BUCKET_SETTINGS = override_settings(
    SUPABASE_URL='https://proj.supabase.co/', SUPABASE_SECRET_KEY='secret-key', SUPABASE_BUCKET='shop',
)


@BUCKET_SETTINGS
class SupabaseTests(StorageCase):
    def sent(self, urlopen):
        return urlopen.call_args.args[0]

    def test_save_posts_to_the_bucket_and_returns_public_url(self):
        with mock.patch('common.storage.urllib.request.urlopen') as urlopen:
            stored = storage.save_image(upload(PNG), 'products')
        request = self.sent(urlopen)
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.full_url, f'https://proj.supabase.co/storage/v1/object/shop/{stored.file_path}')
        self.assertEqual(request.data, PNG)
        self.assertEqual(request.get_header('Content-type'), 'image/png')
        self.assertEqual(request.get_header('Authorization'), 'Bearer secret-key')
        self.assertEqual(stored.bucket_name, 'shop')
        self.assertEqual(
            stored.public_url, f'https://proj.supabase.co/storage/v1/object/public/shop/{stored.file_path}',
        )
        self.assertEqual(list(Path(self.tmp.name).iterdir()), [])

    def test_bad_file_is_rejected_before_any_request(self):
        with mock.patch('common.storage.urllib.request.urlopen') as urlopen:
            with self.assertRaises(storage.ImageRejected):
                storage.save_image(upload(b'<?php ?>'), 'products')
        urlopen.assert_not_called()

    def test_failed_upload_is_a_storage_error(self):
        for error in (urllib.error.URLError('down'), TimeoutError('slow')):
            with mock.patch('common.storage.urllib.request.urlopen', side_effect=error):
                with self.assertRaises(storage.StorageError):
                    storage.save_image(upload(), 'products')

    def test_delete_sends_one_request_with_every_path(self):
        with mock.patch('common.storage.urllib.request.urlopen') as urlopen:
            storage.delete_files(['products/a.jpg', 'products/b.png'])
        request = self.sent(urlopen)
        self.assertEqual(request.get_method(), 'DELETE')
        self.assertEqual(request.full_url, 'https://proj.supabase.co/storage/v1/object/shop')
        self.assertEqual(json.loads(request.data), {'prefixes': ['products/a.jpg', 'products/b.png']})

    def test_delete_with_nothing_to_remove_sends_nothing(self):
        with mock.patch('common.storage.urllib.request.urlopen') as urlopen:
            storage.delete_files([])
        urlopen.assert_not_called()

    def test_delete_error_is_swallowed(self):
        with mock.patch('common.storage.urllib.request.urlopen', side_effect=urllib.error.URLError('down')):
            storage.delete_files(['products/a.jpg'])

    def test_partial_settings_keep_local_disk(self):
        with override_settings(SUPABASE_BUCKET=''), mock.patch('common.storage.urllib.request.urlopen') as urlopen:
            stored = storage.save_image(upload(), 'products')
        urlopen.assert_not_called()
        self.assertEqual(stored.bucket_name, 'local')
