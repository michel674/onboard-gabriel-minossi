import * as bcrypt from 'bcrypt';
import { User } from "@src/entity/User";
import { formatError } from "@src/error";
import { GraphQLServer } from 'graphql-yoga';
import { Context, ContextCallback } from 'graphql-yoga/dist/types';
import * as jwt from 'jsonwebtoken';
import { getRepository, Repository } from "typeorm";

const typeDefs = `
type Query {
    hello: String
}

type Mutation {
    login(email: String!, password: String!, rememberMe: Boolean): Login
    createUser(user: UserInput!): User!
}

type User {
    id: ID!
    name: String!
    email: String!
    birthDate: String!
    cpf: Int!
}

input UserInput {
    name: String!
    email: String!
    password: String!
    birthDate: String!
    cpf: Int!
}

type Login {
    user: User!
    token: String!
}
`;

const getVerification = (context: Context) => {
    const auth = context.request.get('Authorization')
    if (!auth) {
        throw new jwt.JsonWebTokenError('You must be logged in!');
    }

    const token = auth.replace('Bearer ', '');    

    const verification = jwt.verify(token, process.env.JWT_SECRET);
    return verification;
};

const resolvers = {
    Query: {
        hello: () => 'Hello!'
    },
    Mutation: {
        login: async (_, { email, password, rememberMe }) => {

            const userRepository: Repository<User> = getRepository(User);

            let user: User;
            try {
                user = await userRepository.findOneOrFail({ where: { email } });
            } catch {
                throw formatError(401, 'Invalid Credentials');
            }
            if (!bcrypt.compareSync(password, user.password)) {
                throw formatError(401, 'Invalid Credentials');
            } else {
                const token = jwt.sign(
                    { id: user.id },
                    process.env.JWT_SECRET,
                    { expiresIn: rememberMe ? "1w" : "1h" }
                );
                return ({ user, token })
            }
        },

        createUser: async (_, { user }, context: ContextCallback) => {
            getVerification(context)

            const isValid = (email: string): boolean => /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)
            const isWeak = (password: string): boolean => !(password.length >= 7 && /^.*(([A-Z].*[a-z])|([a-z].*[A-Z]))+.*$/.test(password))

            if (!isValid(user.email)) {
                throw formatError(400, 'Invalid email');
            }

            if (isWeak(user.password)) {
                throw formatError(400, 'Password must be at least 7 characters long' +
                    'and must contain at last one letter and one digit')
            }

            const userRepository = getRepository(User);

            if (await userRepository.findOne({ where: { email: user.email } })) {
                throw formatError(400, 'Email already in use');
            }

            const newUser = {
                name: user.name,
                email: user.email.toLowerCase(),
                password: bcrypt.hashSync(user.password, bcrypt.genSaltSync(6)),
                birthDate: user.birthDate,
                cpf: user.cpf,
            }
            return userRepository.save(newUser);
        }
    },
};

export const graphQLServer = new GraphQLServer({
    typeDefs,
    resolvers,
    context: request => request
});
