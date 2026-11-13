'use client';

// Shared "eyebrow + title + description" banner used at the top of each dashboard section.
// Linear/Vercel-style: a small bordered icon tile, a tight semibold title, muted supporting text.
export default function PageHeader({ icon: Icon, eyebrow, title, description, border = true }) {
  return (
    <div className={`flex items-start gap-3 sm:gap-4 ${border ? 'border-b border-gray-200 pb-5 dark:border-gray-800' : ''}`}>
      {Icon && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-bfp-red shadow-sm dark:bg-gray-900 dark:text-red-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium text-gray-500">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
    </div>
  );
}
