import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

type CustomPostSelect = Prisma.kiitsocialSelect<DefaultArgs> & {
  commentCount?: Prisma.CommentsCountAggregateInputType;
  lastComment?: Prisma.CommentsSelect | null;
};

export { CustomPostSelect };