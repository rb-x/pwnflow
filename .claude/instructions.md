# Pwnflow Project Instructions

## Project Overview
Pwnflow is a penetration testing workflow and project management application built with modern web technologies. The frontend is a React-based single-page application focused on security assessment visualization, collaboration, and reporting.

## Tech Stack

### Core Framework
- **React** (latest stable) - UI library
- **TypeScript** (latest stable) - Type safety
- **Vite** (latest stable) - Build tool and dev server
- **React Router DOM** (latest stable) - Client-side routing

### Styling & UI
- **Tailwind CSS (latest stable)** - Utility-first CSS framework
- **@tailwindcss/vite** - Vite integration
- **@tailwindcss/typography** - Rich text styling
- **shadcn/ui** - Component library built on Radix UI primitives
- **Radix UI** - Unstyled, accessible component primitives
- **class-variance-authority (CVA)** - Component variant management
- **tailwind-merge** - Tailwind class merging utility
- **clsx** - Conditional class names
- **Framer Motion (latest stable)** - Animation library
- **Lucide React** - Icon library

### State Management & Data Fetching
- **Zustand (latest stable)** - Lightweight state management
- **TanStack Query (latest stable)** - Server state management, data fetching, caching
- **Axios (latest stable)** - HTTP client

### Forms & Validation
- **React Hook Form (latest stable)** - Form state management
- **Zod (latest stable)** - Schema validation
- **@hookform/resolvers** - Zod integration with React Hook Form

### Rich Text & Markdown
- **TipTap (latest stable)** - Headless rich text editor
  - `@tiptap/react` - React integration
  - `@tiptap/starter-kit` - Essential extensions
  - `@tiptap/extension-*` - Additional extensions (highlight, link, placeholder, underline, code-block-lowlight)
  - `tiptap-markdown` - Markdown support
  - `lowlight` - Syntax highlighting
- **React Markdown (latest stable)** - Markdown rendering
- **remark-gfm** - GitHub Flavored Markdown support

### Visualization & Diagrams
- **@xyflow/react (latest stable)** - Interactive flow diagrams and node graphs
- **@dagrejs/dagre** - Graph layout algorithm
- **@tanstack/react-virtual** - Virtual scrolling for large lists

### Utilities
- **date-fns (latest stable)** - Date manipulation
- **fuse.js 7.1.0** - Fuzzy search
- **use-debounce 10.0.6** - Debouncing hook
- **react-dropzone 14.3.8** - File upload
- **sonner 2.0.7** - Toast notifications
- **cmdk** - Command palette

### Fonts
- **@fontsource/geist** - Primary font
- **@fontsource/geist-mono** - Monospace font
- **@fontsource/geist-sans** - Sans-serif font

### Package Manager
- **pnpm (latest stable)** - Fast, disk space efficient package manager

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components (Radix UI wrappers)
│   ├── editor/         # TipTap editor components
│   ├── mindmap/        # Mind map visualization components
│   ├── scope/          # Project scope components
│   ├── settings/       # Settings UI components
│   ├── export/         # Export functionality
│   ├── import/         # Import functionality
│   ├── icons/          # Custom icon components
│   └── stable/         # Stable/core components
├── pages/              # Page components (routes)
├── layouts/            # Layout components
├── hooks/              # Custom React hooks
├── store/              # Zustand stores
├── services/           # API services and data fetching
├── routes/             # Route definitions
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── config/             # Configuration files
├── extensions/         # Custom extensions
├── App.tsx             # Root app component
├── main.tsx            # Application entry point
└── index.css           # Global styles (Tailwind)
```

## Coding Guidelines

### Component Patterns
- Use **functional components** with hooks
- Prefer **named exports** for components
- Use **TypeScript interfaces** for props (suffix with `Props`)
- Follow the **composition pattern** for complex components
- Keep components **focused and single-responsibility**

### Styling
- Use **Tailwind CSS utility classes** for styling
- Use **shadcn/ui components** from `@/components/ui/`
- Use **CVA (class-variance-authority)** for component variants
- Use **cn()** utility from `@/lib/utils` for conditional classes
- Custom styles should be in **index.css** using `@layer` directives

### State Management
- Use **Zustand** for global application state
- Use **TanStack Query** for server state (API data, caching)
- Use **React Hook Form + Zod** for form state
- Use **useState/useReducer** for local component state
- Keep state as close to where it's used as possible

### Data Fetching
- Use **TanStack Query** (`useQuery`, `useMutation`) for all API calls
- Define queries in **services/** directory
- Use **Axios** for HTTP requests
- Handle loading, error, and success states explicitly
- Use proper query keys for cache management

### Forms
- Use **React Hook Form** with **Zod schema validation**
- Define Zod schemas in the same file or separate schema files
- Use **@hookform/resolvers/zod** for integration
- Leverage **Form components** from shadcn/ui (`Form`, `FormField`, etc.)

### Type Safety
- Define **explicit types** for all props, functions, and API responses
- Avoid using `any` - use `unknown` if type is truly unknown
- Use **type inference** where appropriate
- Define shared types in **src/types/**

### Routing
- Use **React Router v7** patterns
- Define routes in **src/routes/**
- Use **lazy loading** for route components where beneficial
- Use `useNavigate` for programmatic navigation
- Use `useParams`, `useSearchParams` for route data

### Path Aliases
- Use **`@/`** alias for imports from `src/`
  ```typescript
  import { Button } from "@/components/ui/button"
  import { useAuth } from "@/hooks/use-auth"
  import { api } from "@/services/api"
  ```

### File Naming
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: kebab-case with `use-` prefix (e.g., `use-auth.ts`)
- **Utils**: kebab-case (e.g., `format-date.ts`)
- **Types**: kebab-case (e.g., `user-types.ts`)
- **UI Components**: kebab-case (e.g., `button.tsx`, `dialog.tsx`)

### Best Practices
- **Always validate user input** with Zod schemas
- **Handle errors gracefully** with proper error boundaries and try-catch
- **Use TypeScript strict mode** - no implicit any
- **Accessibility first** - use semantic HTML and ARIA attributes
- **Performance**: Use React.memo, useMemo, useCallback judiciously
- **Security**: Never expose API keys or secrets in frontend code
- **Code splitting**: Lazy load heavy components and routes
- **Testing**: Write tests for critical business logic

### Security Considerations
- This is a **penetration testing tool** - security is paramount
- **Sanitize all user input** before rendering or storing
- **Validate data** on both client and server
- **Use HTTPS** for all API communications
- **Implement proper authentication/authorization**
- **Never log sensitive information** (passwords, tokens, etc.)

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Build with type checking
pnpm build:check

# Lint code
pnpm lint

# Preview production build
pnpm preview

# Update packages
pnpm update

# Security audit
pnpm audit
```

## Common Patterns

### Creating a new page component
```typescript
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { api } from "@/services/api"

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-data"],
    queryFn: () => api.getData()
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold">My Page</h1>
      <Button>Click me</Button>
    </div>
  )
}
```

### Creating a form with validation
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email")
})

type FormData = z.infer<typeof schema>

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  const onSubmit = (data: FormData) => {
    console.log(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

### Creating a Zustand store
```typescript
import { create } from "zustand"

interface AppState {
  count: number
  increment: () => void
  decrement: () => void
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 }))
}))
```

## Notes
- This project uses **pnpm**, not npm or yarn
- **Tailwind CSS v4** is the latest major version - syntax may differ from v3
- **React 19** has new features like the Compiler and improved hooks
- **shadcn/ui** components are copied into the project and customizable
- All **UI components** follow Radix UI accessibility standards
