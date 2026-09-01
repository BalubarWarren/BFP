import { NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../../lib/auth';

export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const annotation = await prisma.annotation.findUnique({
      where: { id: parseInt(params.annotationId) },
    });

    if (!annotation || annotation.reportId !== parseInt(params.id)) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    if (annotation.authorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.annotation.delete({ where: { id: annotation.id } });

    return NextResponse.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}
