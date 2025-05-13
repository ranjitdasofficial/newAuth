// create-ticket.dto.ts
export class CreateTicketDto {
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  userId: string;
}

// update-ticket.dto.ts
export class UpdateTicketDto {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
}

// create-message.dto.ts
export class CreateMessageDto {
  content: string;
  sender: string;
  isResolution?: boolean;
  status?: string;
}

// update-message.dto.ts
export class UpdateMessageDto {
  content?: string;
  isResolution?: boolean;
}
