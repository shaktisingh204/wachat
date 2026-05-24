const MessageRowMemo = React.memo(MessageRow, (prev, next) => prev.message._id === next.message._id);

const MessageList = React.memo(function MessageList({ messages, meId }: { messages: WithId<TeamMessage>[]; meId?: string }) {
    return <>{renderMessagesWithDateDividers(messages, meId)}</>;
}, (prev, next) => {
    if (prev.messages.length !== next.messages.length) return false;
    for (let i = 0; i < prev.messages.length; i++) {
        if (prev.messages[i]._id !== next.messages[i]._id) return false;
    }
    return true;
});
