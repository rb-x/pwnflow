# 8. Use React Hook Form and Zod for Forms

Date: 2025-07-26

## Status

Accepted

## Context

We need robust form handling for:

- User registration and login
- Project creation and editing
- Finding documentation
- Search and filter forms
- Multi-step wizards
- Forms with complex validation rules

Requirements:
- Minimal re-renders for performance
- Type-safe validation
- Good developer experience
- Integration with UI components
- Client-side validation before API calls

## Decision

We will use **React Hook Form (latest stable)** for form state management and **Zod (latest stable)** for schema validation.

## Consequences

### Positive

- **Performance**: Uncontrolled components minimize re-renders
- **Small Bundle**: React Hook Form is ~9KB, Zod is ~13KB gzipped
- **Developer Experience**: Simple hook-based API
- **Type Safety**: Full type inference from Zod schemas to form data
- **Validation**: Declarative, type-safe validation with Zod
- **Integration**: Excellent integration via @hookform/resolvers
- **Error Handling**: Built-in error message management
- **Field Arrays**: Support for dynamic field arrays
- **Watch Values**: Easy to watch and react to field changes
- **DevTools**: React Hook Form DevTools for debugging
- **Zod Reusability**: Zod schemas can be reused for API validation

### Negative

- **Uncontrolled Components**: Different mental model from controlled components
- **Learning Curve**: Need to learn React Hook Form API and patterns
- **Zod Verbosity**: Complex schemas can become verbose
- **Field Registration**: Need to register fields (though can be simplified)
- **Custom Components**: Requires Controller wrapper for custom controlled components

### Neutral

- **Schema Definition**: Need to define Zod schemas for each form
- **Error Messages**: Need to provide custom error messages in schemas
- **Validation Timing**: Need to configure when validation runs (onSubmit, onChange, onBlur)
- **Form Reset**: Need to explicitly reset forms after submission
