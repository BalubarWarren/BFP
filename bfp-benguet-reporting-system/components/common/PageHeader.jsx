'use client';

// Shared "eyebrow + title + description" banner used at the top of each dashboard section —
// gives the plain uppercase label an icon chip and a divider instead of just floating text.
export default function PageHeader({ icon: Icon, eyebrow, title, description, border = true }) {
  return (
    <div className={`flex items-start gap-4 ${border ? 'border-b border-gray-200 pb-5' : ''}`}>
      {Icon && (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-bfp-red/10 text-bfp-red">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-wider text-bfp-red">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-3xl font-bold text-bfp-navy">{title}</h1>
        {description && <p className="mt-1 text-gray-500">{description}</p>}
      </div>
    </div>
  );
}
