import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";

@Injectable()
export class NextAuth implements CanActivate{

    constructor(private JWTService:JwtService){}
    async canActivate(context: ExecutionContext):Promise<boolean>  {
        
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        console.log(authHeader,request.body)
        if(!authHeader) throw new UnauthorizedException();

        const [type,token] = authHeader.split(' ');
        if(type !== 'Bearer') throw new UnauthorizedException();

        try {
            const user = await this.JWTService.verifyAsync(token,{
                secret:process.env.NEXTAUTH_SECRET
            })
            console.log(user)
            request['user']= user;
         
        } catch (error) {
            console.log(error);
            throw new UnauthorizedException();
            
        }


        return true;
        
    }

}