import {
    WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket,
    OnGatewayConnection, OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TicketsService } from 'src/tickets/tickets.service';

@WebSocketGateway({
    cors: { origin: '*' }
})
export class WebSocketService implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    constructor(private readonly ticketsService: TicketsService) { }


    // Map to store userId <-> socketId
    private users = new Map<string, string>();

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
        const userId = client.handshake.auth.userId as string;
        console.log(userId)
        if (userId) {
            this.users.set(userId, client.id);
            console.log(`User ${userId} connected with socket ${client.id}`);
        }
    }

    handleDisconnect(client: Socket) {
        // Remove user from map on disconnect
        for (const [userId, socketId] of this.users.entries()) {
            if (socketId === client.id) {
                this.users.delete(userId);
                break;
            }
        }
    }

    @SubscribeMessage('private-message')
    async handlePrivateMessage(
        @MessageBody() data: { to: string; message: string; from: string, ticketId: string,isResolution: boolean,status?: string },
        @ConnectedSocket() client: Socket
    ) {
        console.log(`Private message from ${data.from} to ${data.to}: ${data.message}`);

        await this.ticketsService.addMessage(data.ticketId, {
            content: data.message,
            sender: data.from,
            isResolution: data.isResolution,
            status: data.status,
        });
        

        const recipientSocketId = this.users.get(data.to);
        console.log(recipientSocketId)


        if (recipientSocketId) {
            // Send message only to the intended recipient
            this.server.to(recipientSocketId).emit('private-message', {
                from: data.from,
                message: data.message,
                ticketId: data.ticketId,
                to: data.to,
            });
        }
    }
}
