import Directory from "../models/directory.model.js";

export const handleFolderSizeUpdate = async (parentDirId, size, session) => {
    const parents = [];
    
    // We add .session(session) to the find query
    while (parentDirId) {
        const directory = await Directory.findById(parentDirId, "parentDirId")
            .session(session)
            .lean();
            
        if (!directory) {
            break;
        }
        parents.push(directory._id);
        parentDirId = directory.parentDirId;
    }

    if (parents.length > 0) {
        // We pass { session } in the options object for updateMany
        await Directory.updateMany(
            { _id: { $in: parents } }, 
            { $inc: { size: size } },
            { session } 
        );
    }
}