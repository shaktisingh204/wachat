import Ajv from 'ajv';

export const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

const commonSchemas: Record<string, any> = {
  Article: {
    type: 'object',
    required: ['headline', 'image', 'datePublished', 'author'],
    properties: {
      headline: { type: 'string' },
      image: { type: ['array', 'string', 'object'] },
      datePublished: { type: 'string' },
      author: { type: ['array', 'object'] },
    },
  },
  NewsArticle: {
    $ref: '#/definitions/Article',
  },
  BlogPosting: {
    $ref: '#/definitions/Article',
  },
  Product: {
    type: 'object',
    required: ['name'],
    anyOf: [
      { required: ['review'] },
      { required: ['aggregateRating'] },
      { required: ['offers'] },
    ],
    properties: {
      name: { type: 'string' },
      image: { type: ['array', 'string', 'object'] },
      review: { type: ['array', 'object'] },
      aggregateRating: { type: 'object' },
      offers: { type: ['array', 'object'] },
    },
  },
  Organization: {
    type: 'object',
    required: ['name', 'url', 'logo'],
    properties: {
      name: { type: 'string' },
      url: { type: 'string' },
      logo: { type: ['string', 'object'] },
    },
  },
  LocalBusiness: {
    type: 'object',
    required: ['name', 'address', 'telephone'],
    properties: {
      name: { type: 'string' },
      address: { type: ['string', 'object'] },
      telephone: { type: 'string' },
    },
  },
  FAQPage: {
    type: 'object',
    required: ['mainEntity'],
    properties: {
      mainEntity: { type: 'array' },
    },
  },
  Event: {
    type: 'object',
    required: ['name', 'startDate', 'location'],
    properties: {
      name: { type: 'string' },
      startDate: { type: 'string' },
      location: { type: ['string', 'object'] },
    },
  },
  Recipe: {
    type: 'object',
    required: ['name', 'image', 'author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions'],
    properties: {
      name: { type: 'string' },
      image: { type: ['array', 'string', 'object'] },
      author: { type: ['array', 'object'] },
      datePublished: { type: 'string' },
      description: { type: 'string' },
      recipeIngredient: { type: 'array' },
      recipeInstructions: { type: ['array', 'object'] },
    },
  },
  BreadcrumbList: {
    type: 'object',
    required: ['itemListElement'],
    properties: {
      itemListElement: { type: 'array' },
    },
  },
  Person: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      url: { type: 'string' },
      image: { type: ['string', 'object'] },
    },
  },
  SoftwareApplication: {
    type: 'object',
    required: ['name', 'applicationCategory', 'operatingSystem'],
    properties: {
      name: { type: 'string' },
      applicationCategory: { type: 'string' },
      operatingSystem: { type: 'string' },
      offers: { type: ['array', 'object'] },
      aggregateRating: { type: 'object' },
    },
  },
};

const masterSchema = {
  $id: 'https://schema.org/validator',
  type: 'object',
  definitions: commonSchemas,
};

ajv.addSchema(masterSchema);

export function validateSchema(type: string, data: any) {
  const schemaRef = `https://schema.org/validator#/definitions/${type}`;
  const validate = ajv.getSchema(schemaRef);
  
  if (!validate) {
    return {
      valid: null, // No schema found for this type, can't validate
      errors: null,
    };
  }

  const valid = validate(data);
  return {
    valid,
    errors: validate.errors,
  };
}
