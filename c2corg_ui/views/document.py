from shapely.geometry import asShape
from shapely.ops import transform
from functools import partial
from urllib import urlencode
import httplib2
import pyproj
import json

from pyramid.httpexceptions import (
    HTTPBadRequest, HTTPNotFound, HTTPInternalServerError)

from c2corg_common.attributes import default_cultures


class Document(object):

    # FIXME Is a "documents" route available/relevant in the API?
    _API_ROUTE = 'documents'

    # FIXME sync with API => use a CONSTANT in c2corg_common?
    _DEFAULT_FILTERS = {
        'limit': 30
    }

    def __init__(self, request):
        self.request = request
        self.settings = request.registry.settings
        self.template_input = {
            'debug': 'debug' in self.request.params,
            'default_cultures': default_cultures,
            'api_url': self.settings['api_url']
        }

    def _call_api(self, url, method='GET', body=None, headers=None):
        http = httplib2.Http()
        try:
            resp, content = http.request(
                url, method=method, body=body, headers=headers
            )
            return resp, json.loads(content)
        except Exception:
            # TODO: return error message as the second item
            return {'status': '500'}, {}

    def _validate_id_culture(self):
        if 'id' not in self.request.matchdict:
            # eg. creating a new document
            return None, None
        try:
            id = int(self.request.matchdict['id'])
        except Exception:
            raise HTTPBadRequest("Incorrect id")

        culture = str(self.request.matchdict['culture'])
        if culture not in default_cultures:
            raise HTTPBadRequest("Incorrect culture")

        return id, culture

    def _get_document(self, id, culture):
        url = '%s/%s/%d?l=%s' % (
            self.settings['api_url'], self._API_ROUTE, id, culture
        )
        resp, document = self._call_api(url)
        # TODO: better error handling
        if resp['status'] == '404':
            raise HTTPNotFound()
        elif resp['status'] != '200':
            raise HTTPInternalServerError(
                "An error occured while loading the document")
        # We need to pass locale data to Mako as a dedicated object to make it
        # available to the parent templates:
        locale = document['locales'][0]
        return document, locale

    def _get_documents(self):
        params = self._get_filter_params()
        # query_string contains filter params using the standard URL format
        # (eg. ?offset=50&limit=20&elevation=>2000).
        query_string = '?' + urlencode(params) if params else ''
        url = '%s/%s%s' % (
            self.settings['api_url'], self._API_ROUTE, query_string
        )
        resp, content = self._call_api(url)
        # Inject default list filters params:
        filters = dict(self._DEFAULT_FILTERS, **{k: v for k, v in params})
        # TODO: better error handling
        if resp['status'] == '200':
            documents = content['documents']
            total = content['total']
        else:
            documents = []
            total = 0
        return documents, total, filters

    def _get_filter_params(self):
        """This function is used to parse the filters provided in URLs such as
        https://www.camptocamp.org/waypoints/offset/50/limit/20/elevation/>2000
        Index page routes such as '/waypoints*filters' store the "filters"
        params in a tuple like for instance:
        ('offset', '50', 'limit', '20', 'elevation', '>2000')
        To make params easier to manipulate, for instance to create the
        matching API URL with urllib.urlencode, tuple items are grouped in
        a list of (key, value) tuples.
        """
        params = []
        if 'filters' in self.request.matchdict:
            filters = self.request.matchdict['filters']
            # If number of filters is odd, add an empty string at the end:
            filters = filters + ('',) if len(filters) % 2 != 0 else filters
            # Group filters as a list of (key, value) tuples
            for i in range(0, len(filters)):
                # Skip odd indices since grouping filters 2 by 2
                if i % 2 == 0:
                    params.append(filters[i:i+2])
        return params

    def _get_history(self):
        id, culture = self._validate_id_culture()
        url = '%s/document/%d/history/%s' % (
            self.settings['api_url'], id, culture)
        resp, content = self._call_api(url)
        # TODO: better error handling
        if resp['status'] == '200':
            versions = content['versions']
            title = content['title']
            self.template_input.update({
                'module': self._API_ROUTE,
                'document_versions': versions,
                'culture': culture,
                'title': title,
                'document_id': id
            })
            return self.template_input
        else:
            raise HTTPNotFound()

    def _get_geometry(self, data):
        return asShape(json.loads(data))

    def _transform(self, geometry, source_epsg, dest_epsg):
        source_proj = pyproj.Proj(init=source_epsg)
        dest_proj = pyproj.Proj(init=dest_epsg)
        project = partial(pyproj.transform, source_proj, dest_proj)
        return transform(project, geometry)