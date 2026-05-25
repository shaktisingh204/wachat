import { User } from '@/lib/definitions';

export type UserProfileFormProps = {
    user: Omit<User, 'password'>;
};

export type ActionResponse = {
    message?: string;
    error?: string;
};
