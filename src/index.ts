import "reflect-metadata";
import { createConnection, Repository, getRepository } from "typeorm";
import { User } from "./entity/User";
import { GraphQLServer } from "graphql-yoga"
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = "SICRET"

//Mocked data
// const user: User = {
//     "id": 12,
//     "name": "User Name",
//     "email": "User e-mail",
//     "birthDate": "04-25-1990",
//     "cpf": 1234567890,
//     password: 'chumbada'
// };

const typeDefs = `
type Query {
    info: String
}

type Mutation {
  login(email: String!, password: String!): Login
}

type User {
    id: ID!
    name: String!
    email: String
    birthDate: String!
    cpf: Int!
}

type Login {
    user: User!
    token: String!
}
`;

// Simply take an auth header and returns the user.
const getUser = async auth => {
    if (!auth) throw new jwt.JsonWebTokenError('you must be logged in!');

    const token = auth.split('Bearer ')[1];
    if (!token) throw new jwt.JsonWebTokenError('you should provide a token!');

    const user = jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) throw new jwt.JsonWebTokenError('invalid token!');
        return decoded;
    });
    return user;
};

//     async deleteTodo(_, { todoId }, { auth }) {
//         const user = await getUser(auth);

const resolvers = {
    Mutation: {
        login: async (_: any, { email, password }) => {
            const userRepository: Repository<User> = getRepository(User);

            let user: User;
            console.log("Searching for user on the database...");
            try {
                user = await userRepository.findOneOrFail({ where: { email } });
            } catch {
                console.log('Invalid credentials');
                throw new Error('Invalid Credentials')
            }
            if (password !== user.password) {
                throw new Error('Invalid Credentials')
            } else {
                const token = jwt.sign(
                    { id: user.id, email: user.email },
                    JWT_SECRET,
                    { expiresIn: "1h" }
                );
                return ({ user, token, })
            }
        },
    },
};

const server = new GraphQLServer({
    typeDefs,
    resolvers,
});

createConnection().then(async connection => {
    server.start(() => console.log(`Server is running on http://localhost:4000`));
}).catch(error => console.log('Error connecting to databse: ' + error));
