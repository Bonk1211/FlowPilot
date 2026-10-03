"""Keep provider schemas small; Pydantic remains the authority for validation."""


def response_schema(schema):
    if isinstance(schema, dict):
        return {
            key: response_schema(value)
            for key, value in schema.items()
            if key
            not in {"maxItems", "minItems", "maxLength", "minLength", "pattern", "default", "title"}
        }
    if isinstance(schema, list):
        return [response_schema(value) for value in schema]
    return schema
