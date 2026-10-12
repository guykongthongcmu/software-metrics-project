from django.http import JsonResponse


def success_body(message=None, data=None):
    body = {'status': 'success'}
    if message is not None:
        body['message'] = message
    if data is not None:
        body['data'] = data
    return body


def error_body(code, message):
    return {'status': 'error', 'code': code, 'message': message}


def success_response(message=None, data=None, status=200):
    return JsonResponse(success_body(message, data), status=status)


def error_response(code, message, status):
    return JsonResponse(error_body(code, message), status=status)
